const externalRequest = require('../../lib/request-external');
const logger = require('@tryghost/logging');
const settingsCache = require('../../../shared/settings-cache');
const crypto = require('crypto');

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'predict_mixin',

    getAccountState: {
        headers: {
            cacheInvalidate: false
        },
        permissions: false,
        async query(frame) {
            let sessionCookie = '';
            if (frame.original?.session?.id) {
                const secret = settingsCache.get('admin_session_secret');
                if (secret) {
                    const sessionId = frame.original.session.id;
                    const signature = crypto
                        .createHmac('sha256', secret)
                        .update(sessionId)
                        .digest('base64')
                        .replace(/\=+$/, '');
                    
                    const signedCookieValue = `s:${sessionId}.${signature}`;
                    sessionCookie = `ghost-admin-api-session=${signedCookieValue}`;
                    logger.info(`[PredictMixin] Constructed session cookie from frame.original.session.id`);
                }
            }

            try {
                const response = await externalRequest('https://test-api.predictionmarkets.org/predict-mixin/pay/account_state', {
                    method: 'GET',
                    headers: {
                        'Cookie': sessionCookie
                        // 'Cookie': "ghost-admin-api-session=s%3AMpawl97fpnevr9x4_TpisqT8l-oDgJZ3.MUaqHnfCvHz6SJPZWQdP4P0oWMGWmdXMxF86a4LahSI"
                    },
                    responseType: 'json',
                    throwHttpErrors: false // 防止非 2xx 响应抛出异常，让我们自己处理
                });
                logger.info(`[PredictMixin] getAccountState response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
                if (response.statusCode >= 400) {
                    // 透传错误状态或返回空
                    return { error: response.body.message || 'error' };
                }

                return [response.body.data];
            } catch (err) {
                // 捕获网络错误，防止 crash
                return {error: err.message};
            }
        }
    },

    getConnectUrl: {
        headers: {
            cacheInvalidate: false
        },
        permissions: false,
        async query(frame) {
            let sessionCookie = '';
            if (frame.original?.session?.id) {
                const secret = settingsCache.get('admin_session_secret');
                if (secret) {
                    const sessionId = frame.original.session.id;
                    const signature = crypto
                        .createHmac('sha256', secret)
                        .update(sessionId)
                        .digest('base64')
                        .replace(/\=+$/, '');
                    
                    const signedCookieValue = `s:${sessionId}.${signature}`;
                    sessionCookie = `ghost-admin-api-session=${encodeURIComponent(signedCookieValue)}`;
                    logger.info(`[PredictMixin] ConnectUrl constructed session cookie`);
                }
            }
            
            try {
                const response = await externalRequest('https://test-api.predictionmarkets.org/predict-mixin/pay/account_bind', {
                    method: 'POST',
                    headers: {
                        'Cookie': sessionCookie
                        // 'Cookie': "ghost-admin-api-session=s%3AMpawl97fpnevr9x4_TpisqT8l-oDgJZ3.MUaqHnfCvHz6SJPZWQdP4P0oWMGWmdXMxF86a4LahSI"
                    },
                    responseType: 'json',
                    throwHttpErrors: false
                });
                 logger.info(`[PredictMixin] getConnectUrl response: ${response.statusCode} - ${JSON.stringify(response.body)}`);
                if (response.statusCode >= 400) {
                    return { error: response.body.message || 'error' };
                }

                return [response.body.data];
            } catch (err) {
                return {error: err.message};
            }
        }
    }
};

module.exports = controller;
