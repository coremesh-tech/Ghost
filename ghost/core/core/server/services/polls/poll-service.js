const db = require('../../data/db');
const errors = require('@tryghost/errors');
const requestExternal = require('../../lib/request-external');
const config = require('../../../shared/config');

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

function buildPollGuestHeaders(req) {
    const guestId = req?.get?.('X-Guest-Id') || req?.headers?.['x-guest-id'] || '';
    if (!guestId) {
        return {};
    }

    return {
        'X-Guest-Id': String(guestId).trim()
    };
}

async function proxyPollApi(path, {method = 'GET', body, member, token = '', req} = {}) {
    const response = await requestExternal(`${getPollApiBaseUrl()}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...buildPollViewerHeaders(member),
            ...buildPollGuestHeaders(req),
            ...(token ? {Authorization: `Bearer ${token}`} : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        throwHttpErrors: false
    });

    return {
        statusCode: response.statusCode,
        body: parseExternalBody(response.body)
    };
}

async function getContentPoll(pollId, member, token = '', req) {
    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}`, {member, token, req});
}

async function getContentPollVotes(pollId, member, token = '', req) {
    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}/votes`, {member, token, req});
}

function normalizePollIdList(pollIds) {
    return (Array.isArray(pollIds) ? pollIds : [])
        .map(id => String(id ?? '').trim())
        .filter(Boolean)
        .slice(0, 100); // 上限, 防滥用
}

/**
 * 批量拉取多个 poll 的定义 (静态数据, 可缓存).
 * 代理到外部 node-market-topic-server 的 GET /polls/batch?ids=a,b,c
 */
async function getContentPollsBatch(pollIds, member, token = '', req) {
    const ids = normalizePollIdList(pollIds);
    if (!ids.length) {
        return {statusCode: 200, body: {polls: {}}};
    }
    const query = encodeURIComponent(ids.join(','));
    return proxyPollApi(`/polls/batch?ids=${query}`, {member, token, req});
}

/**
 * 批量拉取多个 poll 的投票结果 (动态 + 因人而异, 不缓存).
 * 代理到外部 node-market-topic-server 的 GET /polls/votes/batch?ids=a,b,c
 */
async function getContentPollVotesBatch(pollIds, member, token = '', req) {
    const ids = normalizePollIdList(pollIds);
    if (!ids.length) {
        return {statusCode: 200, body: {votes: {}}};
    }
    const query = encodeURIComponent(ids.join(','));
    return proxyPollApi(`/polls/votes/batch?ids=${query}`, {member, token, req});
}

/**
 * 拉取 poll 的投票趋势 (历史时间序列).
 * 外部 prediction-markets 服务提供公开的 content trends endpoint;
 * 这里通过 Ghost 后端代理后再下发给 reading mode 的浏览器.
 *
 * @param {string} pollId
 * @param {{from?: string, to?: string, resolution?: string}} [params]
 * @param {object} [member]
 */
async function getContentPollTrends(pollId, params = {}, member, req) {
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

    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}/trends${query}`, {member, req});
}

async function submitPollVote(pollId, payload, member, req) {
    const authorization = req?.headers?.authorization || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();

    return proxyPollApi(`/polls/${encodeURIComponent(pollId)}/votes`, {
        method: 'POST',
        body: payload,
        member,
        token,
        req
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
    getContentPollsBatch,
    getContentPollTrends,
    getContentPollVotes,
    getContentPollVotesBatch,
    normalizePollNode,
    submitPollVote
};
