const externalRequest = require("../../lib/request-external");
const logger = require("@tryghost/logging");
const settingsCache = require("../../../shared/settings-cache");
const config = require("../../../shared/config");
const crypto = require("crypto");

const predictionMarketsApiUrl = config.get("PREDICTIONMARKETS_API_URL");

const generateCookie = (sessionId) => {
    if (!sessionId) return;
    const secret = settingsCache.get("admin_session_secret");
    if (!secret) return;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(sessionId)
        .digest("base64")
        .replace(/\=+$/, "");
    return `ghost-admin-api-session=s:${sessionId}.${signature}`;
};

const controllerConfig = {
    headers: {
        cacheInvalidate: false,
    },
    permissions: false,
};

const requestWithSession = async (frame, { url, method, body = null }) => {
    const sessionCookie = generateCookie(frame?.original?.session?.id);
    try {
        const options = {};
        if (method !== "GET" && body) {
            options.body = body;
        }
        const response = await externalRequest(url, {
            method,
            headers: {
                Cookie: sessionCookie,
            },
            responseType: "json",
            throwHttpErrors: false,
            ...options,
        });
        logger.info(
            `[PredictMixin] ${method} ${url} -> ${
                response.statusCode
            } - ${JSON.stringify(response.body)}`
        );
        if (response.statusCode >= 400) {
            return { error: response.body?.message || "error" };
        }
        return response.body?.data;
    } catch (err) {
        return { error: err.message };
    }
};

const api = {
    accountState: () =>
        `${predictionMarketsApiUrl}/predict-mixin/pay/account_state`,
    accountBind: () =>
        `${predictionMarketsApiUrl}/predict-mixin/pay/account_bind`,
    accountUnbind: () =>
        `${predictionMarketsApiUrl}/predict-mixin/pay/account_unbind`,
    staffSubmit: (id) =>
        `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${id}/submit`,
    staffWithdraw: (id) =>
        `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${id}/withdraw`,
    staffQuery: () =>
        `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/query`,
    adminApprove: (id) =>
        `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${id}/approve`,
    adminReject: (id) =>
        `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${id}/reject`,
    adminQuery: () =>
        `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/query`,
};

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: "predict_mixin",

    getAccountState: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.accountState(),
                method: "GET",
            }),
    },

    getConnectUrl: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.accountBind(),
                method: "POST",
            }),
    },

    accountUnbind: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.accountUnbind(),
                method: "POST",
            }),
    },

    staffSubmit: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.staffSubmit(frame.original.query.ghost_post_id),
                method: "POST",
            }),
    },

    staffWithdraw: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.staffWithdraw(frame.original.query.ghost_post_id),
                method: "POST",
            }),
    },

    getStaffPostSubmissions: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.staffQuery(),
                method: "POST",
                body: frame.original.params.ghost_post_ids,
            }),
    },

    adminApprove: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.adminApprove(frame.original.query.ghost_post_id),
                method: "POST",
            }),
    },

    adminReject: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.adminReject(frame.original.query.ghost_post_id),
                method: "POST",
            }),
    },

    getAdminPostSubmissions: {
        ...controllerConfig,
        query: (frame) =>
            requestWithSession(frame, {
                url: api.adminQuery(),
                method: "POST",
                body: frame.original.params.ghost_post_ids,
            }),
    },
};

module.exports = controller;
