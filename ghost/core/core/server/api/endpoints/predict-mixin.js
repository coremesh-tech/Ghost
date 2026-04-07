const externalRequest = require('../../lib/request-external');
const logger = require('@tryghost/logging');
const settingsCache = require('../../../shared/settings-cache');
const config = require('../../../shared/config');
const crypto = require('crypto');
const qs = require('qs');

// const predictionMarketsApiUrl = config.get('PREDICTIONMARKETS_API_URL');
const predictionMarketsApiUrl = "https://test-api.predictionmarkets.org";

const generateCookie = (sessionId) => {
    if (!sessionId) {
        return;
    }
    const secret = settingsCache.get('admin_session_secret');
    if (!secret) {
        return;
    }
    const signature = crypto
        .createHmac('sha256', secret)
        .update(sessionId)
        .digest('base64')
        .replace(/=+$/, '');
    return `ghost-admin-api-session=s:${sessionId}.${signature}`;
};

const controllerConfig = {
    headers: {
        cacheInvalidate: false
    },
    permissions: false
};

const requestWithSession = async (frame, {url, method, body = null}) => {
    let authorizationHeader = null;
    
    let parsedBody = body;
    if (typeof body === 'string') {
        try {
            parsedBody = JSON.parse(body);
        } catch (e) {}
    }

    logger.info(`[PredictMixin] requestWithSession - body: ${JSON.stringify(body)} token: ${parsedBody?.token}`);
    
    if (parsedBody?.token) {
        authorizationHeader = `Bearer ${parsedBody.token}`;
    }

    const sessionCookie = generateCookie(frame?.original?.session?.id);
    try {
        const options = {};
        if (method !== 'GET' && !parsedBody?.token && body) {
            options.body = body;
        }
        const headers = {
            'Content-Type': 'application/json'
        };
        if (authorizationHeader) {
            headers.Authorization = authorizationHeader;
        } else if (sessionCookie) {
            headers.Cookie = sessionCookie;
        }

        const response = await externalRequest(url, {
            method,
            headers,
            responseType: 'json',
            throwHttpErrors: false,
            ...options
        });
        logger.info(
            `[PredictMixin] ${method} ${url} -> ${
                response.statusCode
            } - ${JSON.stringify(response.body)}`
        );
        if (response.statusCode >= 400) {
            return {error: response.body?.message || 'error'};
        }
        return response.body?.data;
    } catch (err) {
        logger.error(`[PredictMixin] requestWithSession - error: ${err.message}`);
        return {error: err.message};
    }
};

const api = {
    accountState: () => `${predictionMarketsApiUrl}/predict-mixin/pay/account_state`,
    accountBind: () => `${predictionMarketsApiUrl}/predict-mixin/pay/account_bind`,
    accountUnbind: () => `${predictionMarketsApiUrl}/predict-mixin/pay/account_unbind`,
    accountbindSync: () => `${predictionMarketsApiUrl}/predict-mixin/pay/account_bind_sync`,
    staffSubmit: id => `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${id}/submit`,
    staffWithdraw: id => `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${id}/withdraw`,
    staffQuery: () => `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/query`,
    adminApprove: id => `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${id}/approve`,
    adminReject: id => `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${id}/reject`,
    adminReopen: id => `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${id}/reopen`,
    adminQuery: () => `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/query`,
    memberStaffApply: () => `${predictionMarketsApiUrl}/predict-mixin/member/staff-apply`,
    staffWalletMe: () => `${predictionMarketsApiUrl}/predict-mixin/staff/wallet/me`,
    staffIncomeMe: body => `${predictionMarketsApiUrl}/predict-mixin/staff/income/me?${qs.stringify(body)}`,
    staffWithdrawAvailable: () => `${predictionMarketsApiUrl}/predict-mixin/staff/withdraw/available`,
    staffWithdrawApply: () => `${predictionMarketsApiUrl}/predict-mixin/staff/withdraw/apply`,
    staffPayoutMe: (body) => `${predictionMarketsApiUrl}/predict-mixin/staff/withdraw/me?${qs.stringify(body)}`,
    adminSettlementList: (body) => `${predictionMarketsApiUrl}/predict-mixin/admin/settlement/list?${qs.stringify(body)}`,
    adminSettlementItems: (settlement_no, pagination) => `${predictionMarketsApiUrl}/predict-mixin/admin/settlement/items/${settlement_no}?${qs.stringify(pagination)}`,
    adminSettlementTransfer: () => `${predictionMarketsApiUrl}/predict-mixin/admin/settlement/transfer`,
    adminWithdrawList: (body) => `${predictionMarketsApiUrl}/predict-mixin/admin/withdraw/list?${qs.stringify(body)}`,
};

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'predict_mixin',

    getAccountState: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.accountState(),
            method: 'GET'
        })
    },

    getConnectUrl: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.accountBind(),
            method: 'POST'
        })
    },

    accountUnbind: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.accountUnbind(),
            method: 'POST'
        })
    },
    
    accountbindSync: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.accountbindSync(),
            method: 'POST'
        })
    },

    staffSubmit: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffSubmit(frame.original.query.ghost_post_id),
            method: 'POST'
        })
    },

    staffWithdraw: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffWithdraw(frame.original.body.ghost_post_id),
            method: 'POST'
        })
    },

    getStaffPostSubmissions: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffQuery(),
            method: 'POST',
            body: JSON.stringify(frame.original.body)
        })
    },

    adminApprove: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminApprove(frame.original.body.ghost_post_id),
            method: 'POST'
        })
    },

    adminReject: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminReject(frame.original.body.ghost_post_id),
            method: 'POST'
        })
    },

    adminReopen: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminReopen(frame.original.body.ghost_post_id),
            method: 'POST'
        })
    },

    getAdminPostSubmissions: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminQuery(),
            method: 'POST',
            body: JSON.stringify(frame.original.body)
        })
    },

    memberStaffApply: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.memberStaffApply(),
            method: 'POST',
            body: JSON.stringify(frame.original.body)
        })
    },

    staffWalletMe: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffWalletMe(),
            method: 'GET'
        })
    },

    staffIncomeMe: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffIncomeMe(frame.original.body),
            method: 'GET'
        })
    },

    staffWithdrawAvailable: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffWithdrawAvailable(),
            method: 'GET'
        })
    },

    staffWithdrawApply: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffWithdrawApply(),
            method: 'POST',
            body: JSON.stringify(frame.original.body)
        })
    },

    staffPayoutMe: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.staffPayoutMe(frame.original.body),
            method: 'GET'
        })
    },

    adminSettlementList: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminSettlementList(frame.original.body),
            method: 'GET'
        })
    },

    adminSettlementItems: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminSettlementItems(frame.original.body.settlement_no, frame.original.body.pagination),
            method: 'GET'
        })
    },

    adminSettlementTransfer: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminSettlementTransfer(),
            method: 'POST',
            body: JSON.stringify(frame.original.body)
        })
    },

    adminWithdrawList: {
        ...controllerConfig,
        query: frame => requestWithSession(frame, {
            url: api.adminWithdrawList(frame.original.body),
            method: 'GET'
        })
    },
};

module.exports = controller;
