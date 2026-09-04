// RATUS: Google 登录 —— OAuth 2.0 授权码流程的纯逻辑封装。
// 这里只做「和 Google 打交道」这件事:拼授权 URL、code 换 token、校验 id_token、
// 签发/校验 state。不碰 express、不碰会员数据,方便单测和以后扩展别的 provider。
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const errors = require('@tryghost/errors');
const request = require('@tryghost/request');
const config = require('../../../shared/config');
const urlUtils = require('../../../shared/url-utils');
const settingsHelpers = require('../settings-helpers');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const SCOPE = 'openid email profile';
const CALLBACK_PATH = '/members/api/auth/google/callback';

// state 是走 URL 的,活得越短越好 —— 用户点一次登录到回调通常 10 秒内完成
const STATE_VALIDITY_SECONDS = 10 * 60;

const getConfig = function getConfig() {
    return config.get('members:googleAuth') || {};
};

const isEnabled = function isEnabled() {
    const {enabled, clientId, clientSecret} = getConfig();
    return Boolean(enabled && clientId && clientSecret);
};

/**
 * 回调地址。三种配置方式:
 *
 *  1. callbackUrl 是数组 —— 显式列出每个域名的完整回调地址,按当前请求的 host 匹配;
 *     匹配不到用第一个。适合想把"哪些域名能登录"写得一目了然的场景。
 *  2. callbackUrl 是非空字符串 —— 写死,不看请求。本地开发用。
 *  3. callbackUrl 留空 —— 按当前请求的 host 推导,但 host 必须在白名单里:
 *     config.url 的 host、alternativeDomains、以及 localhost。白名单外退回 config.url。
 *     这和本 fork 里 magic link 的多域名处理(members-config-provider.js)是同一条安全红线:
 *     Host 头是客户端可控的,不能无条件跟着它走。
 *
 * 为什么不能只用 config.url:站点是多域名的(predictionmarkets / informarket …),
 * 会话 cookie 必须落在用户当前访问的那个域名上,否则登录完等于没登录。
 * 代价是每个对外域名都要在 Google Console 里登记一条 redirect_uri。
 *
 * 授权请求和 code 换 token 两步给 Google 的 redirect_uri 必须一致 ——
 * 两步由同一次浏览器导航触发、host 相同,推导结果天然一致。
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
const getCallbackUrl = function getCallbackUrl(req) {
    const configured = getConfig().callbackUrl;
    const requestHost = String(req.get('host') || '').toLowerCase();
    const subdir = urlUtils.getSubdir() || '';

    // 1) 显式列表
    if (Array.isArray(configured) && configured.length > 0) {
        const match = configured.find((candidate) => {
            try {
                return new URL(candidate).host.toLowerCase() === requestHost;
            } catch (err) {
                return false;
            }
        });
        return match || configured[0];
    }

    // 2) 写死
    if (typeof configured === 'string' && configured) {
        return configured;
    }

    // 3) 白名单内按 host 推导
    const siteUrl = new URL(urlUtils.getSiteUrl());
    const allowedHosts = new Set([
        siteUrl.host.toLowerCase(),
        ...(config.get('alternativeDomains') || []).map(host => String(host).toLowerCase())
    ]);
    const isLocalhost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestHost);

    if (requestHost && (allowedHosts.has(requestHost) || isLocalhost)) {
        return `${req.protocol}://${requestHost}${subdir}${CALLBACK_PATH}`;
    }

    // 白名单外:退回 config.url。这时 cookie 会落在 canonical 域名上,
    // 对一个本来就不该被服务的 Host 来说,登录失败是正确的结果。
    return `${siteUrl.protocol}//${siteUrl.host}${subdir}${CALLBACK_PATH}`;
};

const getStateSecret = function getStateSecret() {
    const secret = settingsHelpers.getMembersValidationKey();
    if (!secret) {
        throw new errors.IncorrectUsageError({
            message: 'Missing members validation key, cannot sign Google auth state'
        });
    }
    return secret;
};

/**
 * 签发 state。里面带上:
 *  - nonce: 和 id_token 里的 nonce 对比,把 id_token 绑定到这一次授权请求
 *  - r: 登录成功后的站内回跳路径(非弹窗模式用)
 *  - popup: 是否弹窗模式
 *
 * @param {object} data
 * @param {string} [data.redirect]
 * @param {boolean} [data.popup]
 * @returns {{state: string, nonce: string}}
 */
const createState = function createState({redirect = '', popup = false} = {}) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = jwt.sign(
        {nonce, r: redirect, popup},
        getStateSecret(),
        {algorithm: 'HS256', expiresIn: STATE_VALIDITY_SECONDS}
    );

    return {state, nonce};
};

/**
 * @param {string} state
 * @returns {{nonce: string, r: string, popup: boolean}}
 */
const verifyState = function verifyState(state) {
    try {
        return jwt.verify(state, getStateSecret(), {algorithms: ['HS256']});
    } catch (err) {
        throw new errors.BadRequestError({
            message: 'Invalid or expired Google auth state',
            err
        });
    }
};

/**
 * @param {object} options
 * @param {string} options.state
 * @param {string} options.nonce
 * @param {string} options.callbackUrl
 * @param {string} [options.loginHint]
 * @returns {string}
 */
const getAuthorizationUrl = function getAuthorizationUrl({state, nonce, callbackUrl, loginHint}) {
    const {clientId} = getConfig();
    const url = new URL(GOOGLE_AUTH_URL);

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    // 每次都让用户确认选哪个账号,避免多账号用户被静默登进上一个账号
    url.searchParams.set('prompt', 'select_account');
    if (loginHint) {
        url.searchParams.set('login_hint', loginHint);
    }

    return url.toString();
};

/**
 * 拿 code 换 token。服务端直连 Google token 端点。
 *
 * @param {object} options
 * @param {string} options.code
 * @param {string} options.callbackUrl
 * @returns {Promise<{id_token: string, access_token: string}>}
 */
const exchangeCodeForTokens = async function exchangeCodeForTokens({code, callbackUrl}) {
    const {clientId, clientSecret} = getConfig();

    const response = await request(GOOGLE_TOKEN_URL, {
        method: 'POST',
        form: {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code'
        },
        responseType: 'json',
        // got v12+ 的写法:两者都必须是对象,传数字会直接抛
        retry: {limit: 1},
        timeout: {request: 10000}
    });

    const body = response.body || {};
    if (!body.id_token) {
        throw new errors.InternalServerError({
            message: 'Google token exchange did not return an id_token'
        });
    }

    return body;
};

/**
 * 校验 id_token 的 claims。
 *
 * 注意:这里**没有**验签。因为 id_token 是我们自己通过 TLS 直连 Google 的 token 端点
 * 换回来的(授权码流程),传输链路本身就保证了来源可信 —— OIDC Core 3.1.3.7 明确允许
 * 这种情况下跳过验签。如果以后改成前端直接把 id_token POST 上来(GIS / One Tap),
 * **必须**补上 JWKS 验签,否则任何人都能伪造。
 *
 * @param {string} idToken
 * @param {string} expectedNonce
 * @returns {{email: string, name: string, sub: string, picture: string}}
 */
const decodeAndValidateIdToken = function decodeAndValidateIdToken(idToken, expectedNonce) {
    const payload = jwt.decode(idToken);

    if (!payload || typeof payload !== 'object') {
        throw new errors.BadRequestError({message: 'Could not decode Google id_token'});
    }

    if (!VALID_ISSUERS.includes(payload.iss)) {
        throw new errors.BadRequestError({message: 'Unexpected issuer in Google id_token'});
    }

    if (payload.aud !== getConfig().clientId) {
        throw new errors.BadRequestError({message: 'Unexpected audience in Google id_token'});
    }

    if (!payload.exp || payload.exp * 1000 < Date.now()) {
        throw new errors.BadRequestError({message: 'Expired Google id_token'});
    }

    if (expectedNonce && payload.nonce !== expectedNonce) {
        throw new errors.BadRequestError({message: 'Nonce mismatch in Google id_token'});
    }

    if (!payload.email) {
        throw new errors.BadRequestError({message: 'Google id_token has no email'});
    }

    // 没验过的邮箱绝不能用来匹配已有会员 —— 否则等于把账号接管做成了功能
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
        throw new errors.BadRequestError({message: 'Google account email is not verified'});
    }

    return {
        email: payload.email.toLowerCase(),
        name: payload.name || payload.given_name || '',
        sub: payload.sub,
        picture: payload.picture || ''
    };
};

/**
 * 用 access_token 拉 userinfo。
 *
 * 为什么需要它:Google 文档明确写了 id_token 里的 name / picture 等 profile claim
 * "never guaranteed to be present" —— 实测首次授权(弹同意屏幕那次)换回来的
 * id_token 经常没有 name,第二次才有。userinfo 端点则总是返回完整资料。
 * 只在 id_token 缺 name 时调,大多数登录不多这一跳。
 *
 * @param {string} accessToken
 * @returns {Promise<{name: string, picture: string}>}
 */
const fetchUserInfo = async function fetchUserInfo(accessToken) {
    const response = await request(GOOGLE_USERINFO_URL, {
        method: 'GET',
        headers: {Authorization: `Bearer ${accessToken}`},
        responseType: 'json',
        retry: {limit: 1},
        timeout: {request: 10000}
    });

    const body = response.body || {};
    return {
        name: body.name || body.given_name || '',
        picture: body.picture || ''
    };
};

module.exports = {
    isEnabled,
    getConfig,
    getCallbackUrl,
    createState,
    verifyState,
    getAuthorizationUrl,
    exchangeCodeForTokens,
    decodeAndValidateIdToken,
    fetchUserInfo,

    // 给测试用
    CALLBACK_PATH,
    STATE_VALIDITY_SECONDS
};
