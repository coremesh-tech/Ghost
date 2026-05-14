const db = require('../../data/db');
const errors = require('@tryghost/errors');
const requestExternal = require('../../lib/request-external');
const config = require('../../../shared/config');
const logger = require('@tryghost/logging');

const predictionMarketsApiUrl = config.get('PREDICTIONMARKETS_API_URL');
// const predictionMarketsApiUrl = "http://host.docker.internal:3000";

function getPollApiBaseUrl() {
    if (!predictionMarketsApiUrl) {
        throw new errors.InternalServerError({
            message: 'Prediction markets API URL is not configured'
        });
    }

    return `${predictionMarketsApiUrl.replace(/\/+$/, '')}/market-topic`;
}

function parseExternalBody(body) {
    if (!body) {
        return null;
    }

    if (typeof body === 'object') {
        return body;
    }

    try {
        return JSON.parse(body);
    } catch (err) {
        return null;
    }
}

function buildPollViewerHeaders(member) {
    if (!member) {
        return {};
    }

    const userId = member.uuid || member.id?.toString?.() || '';
    const userName = member.name || member.email || userId;

    return {
        'X-User-Id': userId,
        'X-User-Name': userName,
        'X-User-Role': 'member',
        ...(member.email ? {'X-User-Email': member.email} : {})
    };
}

async function proxyPollApi(path, {method = 'GET', body, member, headers = {}} = {}) {
    const response = await requestExternal(`${getPollApiBaseUrl()}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            "Accept": "application/json",
            ...buildPollViewerHeaders(member),
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined
    });

    return {
        statusCode: response.statusCode,
        body: parseExternalBody(response.body)
    };
}

async function getContentPoll(pollId, member) {
    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}`, {member});
}

async function getContentPollVotes(pollId, member) {
    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}/votes`, {member});
}

/**
 * 拉取 poll 的投票趋势 (历史时间序列).
 * 外部 prediction-markets 服务的 trends 接口走 /admin 前缀
 * (与 Koenig 编辑器侧 getAdminPollTrends 用的同一个上游 endpoint);
 * 这里通过 Ghost 后端代理后再下发给 reading mode 的浏览器, 顺手带上 member header.
 *
 * @param {string} pollId
 * @param {{from?: string, to?: string, resolution?: string}} [params]
 * @param {object} [member]
 */
async function getContentPollTrends(pollId, params = {}, member) {
    const search = new URLSearchParams();
    if (params.from) {
        search.set('from', params.from);
    }
    if (params.to) {
        search.set('to', params.to);
    }
    if (params.resolution) {
        search.set('resolution', params.resolution);
    }
    const query = search.toString() ? `?${search.toString()}` : '';

    return proxyPollApi(`/admin/polls/${encodeURIComponent(pollId)}/trends${query}`, {member});
}

async function submitPollVote(pollId, payload, member, req) {
    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}/votes`, {
        method: 'POST',
        body: payload,
        member,
        headers: req.headers
    });
}

function normalizeStringArray(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map(value => value?.toString?.() ?? '')
        .filter(Boolean);
}

function normalizeOptions(options) {
    if (!Array.isArray(options)) {
        return [];
    }

    return options.map((option, index) => {
        return {
            id: option?.id?.toString?.() ?? `opt_${index}`,
            text: option?.text?.toString?.() ?? '',
            voteCount: Number(option?.voteCount ?? option?.vote_count ?? 0),
            voteRate: Number(option?.voteRate ?? option?.vote_rate ?? 0),
            sortOrder: Number(option?.sortOrder ?? option?.sort_order ?? index)
        };
    });
}

function normalizePollNode(node = {}) {
    return {
        pollId: node.pollId || node.poll_id || '',
        title: node.title || '',
        description: node.description || '',
        imageSrc: node.imageSrc || node.image_src || '',
        expiresAt: node.expiresAt || node.expires_at || '',
        pollType: node.pollType || node.poll_type || 'single',
        status: node.status || 'draft',
        answerRevealed: Boolean(node.answerRevealed ?? node.answer_revealed ?? false),
        correctOptionIds: normalizeStringArray(node.correctOptionIds || node.correct_option_ids || []),
        selectedOptionIds: normalizeStringArray(node.selectedOptionIds || node.selected_option_ids || []),
        options: normalizeOptions(node.options),
        totalVotes: Number(node.totalVotes ?? node.total_votes ?? 0)
    };
}

function extractPollNodeFromLexical(lexical, pollId) {
    if (!lexical) {
        return null;
    }

    let lexicalState;

    try {
        lexicalState = typeof lexical === 'string' ? JSON.parse(lexical) : lexical;
    } catch (err) {
        return null;
    }

    const children = lexicalState?.root?.children || [];

    for (const child of children) {
        if (child?.type !== 'poll') {
            continue;
        }

        const nodePollId = child.pollId || child.poll_id || '';

        if (nodePollId === pollId) {
            return normalizePollNode(child);
        }
    }

    return null;
}

async function findPublishedPollById(pollId) {
    if (!pollId) {
        return null;
    }

    const rows = await db.knex('posts')
        .select('id', 'uuid', 'slug', 'title', 'lexical')
        .where('status', 'published')
        .andWhere('lexical', 'like', `%${pollId}%`)
        .orderBy('updated_at', 'desc');

    for (const row of rows) {
        const poll = extractPollNodeFromLexical(row.lexical, pollId);

        if (poll) {
            return {
                ...poll,
                post: {
                    id: row.id,
                    uuid: row.uuid,
                    slug: row.slug,
                    title: row.title
                }
            };
        }
    }

    return null;
}

module.exports = {
    buildPollViewerHeaders,
    extractPollNodeFromLexical,
    findPublishedPollById,
    getContentPoll,
    getContentPollTrends,
    getContentPollVotes,
    normalizePollNode,
    submitPollVote
};
