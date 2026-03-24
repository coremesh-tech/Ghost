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

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: "predict_mixin",

    getAccountState: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/pay/account_state`,
                    {
                        method: "GET",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false, // 防止非 2xx 响应抛出异常，让我们自己处理
                    }
                );
                logger.info(
                    `[PredictMixin] getAccountState response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    // 透传错误状态或返回空
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                // 捕获网络错误，防止 crash
                return { error: err.message };
            }
        },
    },

    getConnectUrl: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/pay/account_bind`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] getConnectUrl response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    accountUnbind: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/pay/account_unbind`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] accountUnbind response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    staffSubmit: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${frame.original.query.ghost_post_id}/submit`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] staffSubmit response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    staffWithdraw: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/${frame.original.query.ghost_post_id}/withdraw`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] staffWithdraw response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    getStaffPostSubmissions: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/staff/post-submissions/query`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                        body: frame.original.params.ghost_post_ids,
                    }
                );
                logger.info(
                    `[PredictMixin] getStaffPostSubmissions response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    adminApprove: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${frame.original.query.ghost_post_id}/approve`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] adminApprove response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    adminReject: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/${frame.original.query.ghost_post_id}/reject`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                    }
                );
                logger.info(
                    `[PredictMixin] adminReject response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
    getAdminPostSubmissions: {
        ...controllerConfig,
        async query(frame) {
            let sessionCookie = generateCookie(frame.original.session.id);
            try {
                const response = await externalRequest(
                    `${predictionMarketsApiUrl}/predict-mixin/admin/post-submissions/query`,
                    {
                        method: "POST",
                        headers: {
                            Cookie: sessionCookie,
                        },
                        responseType: "json",
                        throwHttpErrors: false,
                        body: frame.original.params.ghost_post_ids,
                    }
                );
                logger.info(
                    `[PredictMixin] getAdminPostSubmissions response: ${
                        response.statusCode
                    } - ${JSON.stringify(response.body)}`
                );
                if (response.statusCode >= 400) {
                    return { error: response.body.message || "error" };
                }

                return response.body.data;
            } catch (err) {
                return { error: err.message };
            }
        },
    },
};

module.exports = controller;
