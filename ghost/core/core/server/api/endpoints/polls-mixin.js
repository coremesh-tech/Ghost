const externalRequest = require('../../lib/request-external');
const logger = require('@tryghost/logging');
const settingsCache = require('../../../shared/settings-cache');
const config = require('../../../shared/config');
const errors = require('@tryghost/errors');
const crypto = require('crypto');
const qs = require('qs');

const predictionMarketsApiUrl = config.get('PREDICTIONMARKETS_API_URL');
// const predictionMarketsApiUrl = "http://host.docker.internal:3000";

const controllerConfig = {
    headers: {
        cacheInvalidate: false
    },
    permissions: false
};

function getPollApiBaseUrl() {
    if (!predictionMarketsApiUrl) {
        throw new errors.InternalServerError({
            message: 'Prediction markets API URL is not configured'
        });
    }

    return `${predictionMarketsApiUrl.replace(/\/+$/, '')}/market-topic`;
}

function generateCookie(sessionId) {
    if (!sessionId) {
        return null;
    }

    const secret = settingsCache.get('admin_session_secret');
    if (!secret) {
        return null;
    }

    const signature = crypto
        .createHmac('sha256', secret)
        .update(sessionId)
        .digest('base64')
        .replace(/=+$/, '');

    return `ghost-admin-api-session=s:${sessionId}.${signature}`;
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

function buildProxyError(statusCode, body) {
    const message = body?.error?.message || body?.message || `Poll API request failed with status ${statusCode}`;
    if (statusCode === 400) {
        return new errors.BadRequestError({
            message,
            statusCode
        });
    }

    if (statusCode === 401) {
        return new errors.UnauthorizedError({
            message,
            statusCode
        });
    }

    if (statusCode === 403) {
        return new errors.NoPermissionError({
            message,
            statusCode
        });
    }

    if (statusCode === 404) {
        return new errors.NotFoundError({
            message,
            statusCode
        });
    }

    if (statusCode === 409) {
        return new errors.ConflictError({
            message,
            statusCode
        });
    }

    return new errors.InternalServerError({
        message,
        statusCode
    });
}

async function requestWithSession(frame, {path, method, body, query} = {}) {
    const sessionCookie = generateCookie(frame?.original?.session?.id);

    if (!sessionCookie) {
        throw new errors.UnauthorizedError({
            message: 'Missing Ghost admin session'
        });
    }

    const queryString = query ? qs.stringify(query, {skipNulls: true}) : '';
    const url = `${getPollApiBaseUrl()}${path}${queryString ? `?${queryString}` : ''}`;

    try {
        const response = await externalRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Cookie: sessionCookie
            },
            body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
            responseType: 'json',
            throwHttpErrors: false
        });

        const responseBody = parseExternalBody(response.body);

        logger.info(`[PollsMixin] ${method} ${url} -> ${response.statusCode}`);

        if (response.statusCode >= 400) {
            throw buildProxyError(response.statusCode, responseBody);
        }

        return responseBody;
    } catch (err) {
        if (err?.errorType) {
            throw err;
        }

        logger.error(`[PollsMixin] ${method} ${url} -> ${err.message}`);

        throw new errors.InternalServerError({
            message: err.message || 'Failed to proxy poll API request'
        });
    }
}

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'polls_mixin',

    saveAdminPoll: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: '/admin/polls',
                method: 'POST',
                body: frame.original.body
            });
        }
    },

    getAdminPoll: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}`,
                method: 'GET'
            });
        }
    },

    publishAdminPoll: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}/publish`,
                method: 'POST'
            });
        }
    },

    unpublishAdminPoll: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}/unpublish`,
                method: 'POST'
            });
        }
    },

    deleteAdminPoll: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}`,
                method: 'DELETE'
            });
        }
    },

    revealAdminPollAnswer: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}/reveal-answer`,
                method: 'POST',
                body: frame.original.body
            });
        }
    },

    getAdminPollVotes: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}/votes`,
                method: 'GET'
            });
        }
    },

    getAdminPollTrends: {
        ...controllerConfig,
        query(frame) {
            return requestWithSession(frame, {
                path: `/admin/polls/${encodeURIComponent(frame.original.params.poll_id)}/trends`,
                method: 'GET',
                query: {
                    from: frame.original.query.from,
                    to: frame.original.query.to,
                    resolution: frame.original.query.resolution
                }
            });
        }
    }
};

module.exports = controller;
