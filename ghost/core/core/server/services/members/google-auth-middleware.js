// RATUS: Google 登录 —— express 层。
// /members/api/auth/google/start   把用户送去 Google
// /members/api/auth/google/callback 回来后建/查会员、种 session、关弹窗
//
// 会员会话的本质就是 members-ssr 那个签名 cookie(值 = member.transient_id),
// 所以这里不需要绕 magic link,拿到 member 直接种 cookie 即可。
const logging = require('@tryghost/logging');
const errors = require('@tryghost/errors');
const Cookies = require('cookies');
const googleAuth = require('./google-auth');
const membersService = require('./service');
const membersMiddleware = require('./middleware');
const models = require('../../models');
const config = require('../../../shared/config');
const settingsCache = require('../../../shared/settings-cache');
const urlUtils = require('../../../shared/url-utils');
const spamPrevention = require('../../web/shared/middleware/api/spam-prevention');
const db = require('../../data/db');
const memberAttributionService = require('../member-attribution');

const NONCE_COOKIE = 'ghost-google-auth-nonce';
// 归因用的浏览历史。放 cookie 而不是塞进 state:state 要跟着跳去 Google,
// 长度受限;历史只需要在我们自己的 /start -> /callback 之间活 10 分钟。
const HISTORY_COOKIE = 'ghost-google-auth-h';
const COOKIE_MAX_AGE = 10 * 60 * 1000;
// cookie 只在 auth 路径下发送,不给全站请求增重
const COOKIE_PATH = `${urlUtils.getSubdir() || ''}/members/api/auth/google`;
const MAX_HISTORY_CHARS = 3000;
const SIGNUP_LABEL = 'Google';

const getCookies = function getCookies(req, res) {
    return new Cookies(req, res, {
        keys: [settingsCache.get('theme_session_secret')],
        secure: urlUtils.isSSL(urlUtils.getSiteUrl())
    });
};

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: COOKIE_PATH,
    signed: false
};

const setAuthCookie = function setAuthCookie(req, res, name, value) {
    getCookies(req, res).set(name, value, {...cookieOptions, maxAge: COOKIE_MAX_AGE});
};

const readAndClearAuthCookie = function readAndClearAuthCookie(req, res, name) {
    const cookies = getCookies(req, res);
    const value = cookies.get(name, {signed: false});
    cookies.set(name, null, cookieOptions);
    return value;
};

/**
 * 只允许站内相对路径,防开放重定向。
 * @param {string} [redirect]
 * @returns {string}
 */
const sanitizeRedirect = function sanitizeRedirect(redirect) {
    if (typeof redirect !== 'string' || !redirect) {
        return '';
    }
    // 必须是单斜杠开头的相对路径。
    //  - "//evil.com" 是协议相对 URL
    //  - "/\\evil.com" 会被浏览器把 \ 归一化成 /,效果同上
    //  - 控制字符 / 空白一律不要
    if (!/^\/(?![\/\\])/.test(redirect) || /[\s\x00-\x1f\x7f]/.test(redirect)) {
        return '';
    }
    return redirect;
};

/**
 * 把值序列化成能安全内嵌进 <script> 的 JSON:JSON.stringify 不转义 "<",
 * 一个带 "</script>" 的字符串就能提前闭合脚本标签。
 */
const toScriptJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * 弹窗模式:回一个极简页面,通知 opener 后自关。
 * 非弹窗模式:直接 302 回站内。
 */
const finish = function finish(req, res, {success, reason = '', redirect = '', popup = false}) {
    const subdir = urlUtils.getSubdir() || '';
    const target = redirect || `${subdir}/`;

    if (!popup) {
        const url = new URL(target, `${req.protocol}://${req.get('host')}`);
        url.searchParams.set('success', String(success));
        if (!success && reason) {
            url.searchParams.set('reason', reason);
        }
        return res.redirect(url.pathname + url.search);
    }

    const payload = toScriptJson({type: 'ghost-google-auth', success, reason});
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in…</title></head>` +
        `<body><script>(function(){var m=${payload};try{if(window.opener&&!window.opener.closed){` +
        `window.opener.postMessage(m,window.location.origin);}}catch(e){}` +
        `try{window.close();}catch(e){}` +
        // 弹窗被浏览器拦成同标签打开时 close() 无效,兜底跳回站内
        `setTimeout(function(){if(!window.opener){window.location.replace(${toScriptJson(target)});}},300);})();</script>` +
        `</body></html>`
    );
};

/**
 * GET /members/api/auth/google/start
 */
const startGoogleAuth = async function startGoogleAuth(req, res) {
    if (!googleAuth.isEnabled()) {
        throw new errors.NotFoundError({message: 'Google sign-in is not enabled'});
    }

    const popup = req.query.popup === '1' || req.query.popup === 'true';
    const redirect = sanitizeRedirect(req.query.r);
    const {state, nonce} = googleAuth.createState({redirect, popup});

    setAuthCookie(req, res, NONCE_COOKIE, nonce);

    // Portal 会把 sessionStorage 里的浏览历史带过来,用于注册归因。
    // express 已经把 query 解码过了,而 JSON 里的 , ; " 不是合法的 cookie 值,
    // 所以重新 encode 一次再存;超长就丢掉 —— 归因不该拖垮登录。
    const history = typeof req.query.h === 'string' ? req.query.h : '';
    if (history) {
        const encoded = encodeURIComponent(history);
        if (encoded.length <= MAX_HISTORY_CHARS) {
            setAuthCookie(req, res, HISTORY_COOKIE, encoded);
        }
    }

    const callbackUrl = googleAuth.getCallbackUrl(req);

    const url = googleAuth.getAuthorizationUrl({
        state,
        nonce,
        callbackUrl,
        loginHint: typeof req.query.email === 'string' ? req.query.email : undefined
    });

    res.redirect(url);
};

/**
 * 按优先级找已有会员:
 *   1. google_sub —— 最可靠。用户在 Google 侧改了邮箱,靠它仍认得出是同一人
 *   2. email 精确匹配
 *   3. email 忽略大小写 —— Ghost 存的是用户当初输入的原样(不做小写化),
 *      MySQL 的 ci 排序规则本来就不区分大小写,但 SQLite 的 = 区分。
 *      只在前两步都没命中(也就是即将注册新会员)时才走,不影响登录热路径。
 *
 * @returns {Promise<{id: string, email: string, name: string|null, google_sub: string|null}|null>}
 */
const findExistingMemberRow = async function findExistingMemberRow({email, sub}) {
    const columns = ['id', 'email', 'name', 'google_sub'];

    if (sub) {
        const bySub = await db.knex('members').where('google_sub', sub).first(columns);
        if (bySub) {
            return bySub;
        }
    }

    const byEmail = await db.knex('members').where('email', email).first(columns);
    if (byEmail) {
        return byEmail;
    }

    return await db.knex('members').whereRaw('lower(email) = ?', [email]).first(columns) || null;
};

/**
 * 从 Portal 带过来的浏览历史算注册归因。算不出来就返回 undefined,
 * 让会员照常创建 —— 归因失败不该挡住注册。
 */
const resolveAttribution = async function resolveAttribution(rawHistory) {
    if (!rawHistory) {
        return undefined;
    }

    try {
        const history = JSON.parse(decodeURIComponent(rawHistory));
        if (!Array.isArray(history) || history.length === 0) {
            return undefined;
        }
        return await memberAttributionService.service.getAttribution(history);
    } catch (err) {
        logging.warn(`[google-auth] could not resolve attribution: ${err.message}`);
        return undefined;
    }
};

/**
 * 查会员,没有就注册一个。
 * 注册分支对齐 members-api 里 magic link 的注册路径,别自己另起一套。
 */
const findOrCreateMember = async function findOrCreateMember({email, name, sub, attribution}) {
    const row = await findExistingMemberRow({email, sub});

    if (row) {
        const patch = {};

        // 首次用 Google 登录一个原本靠邮箱注册的会员 —— 把 sub 补上完成关联。
        if (sub && !row.google_sub) {
            patch.google_sub = sub;
        }

        // 老会员没填过名字的,用 Google 的名字补上。**只补空,不覆盖**:
        // 用户在站内自己改过的名字永远优先于 Google 那边的。
        if (name && !(row.name || '').trim()) {
            patch.name = name;
        }

        // 直接走 knex:都是记账性质的补全,不值得触发 member-updated 那一串事件。
        if (Object.keys(patch).length > 0) {
            await db.knex('members').where('id', row.id).update(patch);
            logging.info(`[google-auth] backfilled ${Object.keys(patch).join(', ')} on existing member ${row.id}`);
        }

        const member = await membersService.api.getMemberIdentityData(row.email);
        if (!member) {
            throw new errors.InternalServerError({message: 'Could not load member for Google account'});
        }

        return {member, isNew: false};
    }

    // Google 通道不能绕过站点的注册策略
    if (!membersService.config.getAllowSelfSignup()) {
        throw new errors.BadRequestError({
            message: 'Signup is not allowed on this site',
            code: 'SIGNUP_NOT_ALLOWED'
        });
    }

    const blockedEmailDomains = settingsCache.get('all_blocked_email_domains') || [];
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain && blockedEmailDomains.includes(emailDomain)) {
        throw new errors.BadRequestError({
            message: 'Signup from this email domain is blocked',
            code: 'BLOCKED_EMAIL_DOMAIN'
        });
    }

    // newsletters 不传 —— 交给 MemberRepository 按站点默认 newsletter 处理,
    // 和邮箱注册保持一致(欢迎邮件自动化也照常触发)。
    await membersService.api.members.create({
        email,
        name,
        google_sub: sub || null,
        labels: [SIGNUP_LABEL],
        attribution
    });

    const member = await membersService.api.getMemberIdentityData(email);

    if (!member) {
        throw new errors.InternalServerError({message: 'Could not create member for Google account'});
    }

    logging.info(`[google-auth] created member ${member.id} from Google sign-in`);

    return {member, isNew: true};
};

/**
 * GET /members/api/auth/google/callback
 */
const googleAuthCallback = async function googleAuthCallback(req, res) {
    if (!googleAuth.isEnabled()) {
        throw new errors.NotFoundError({message: 'Google sign-in is not enabled'});
    }

    let stateData = {};

    try {
        stateData = googleAuth.verifyState(req.query.state);
    } catch (err) {
        // state 都验不过就没有可信的 popup/redirect 信息了,按弹窗兜底
        readAndClearAuthCookie(req, res, NONCE_COOKIE);
        readAndClearAuthCookie(req, res, HISTORY_COOKIE);
        return finish(req, res, {success: false, reason: 'invalid_state', popup: true});
    }

    const popup = Boolean(stateData.popup);
    const redirect = sanitizeRedirect(stateData.r);
    const cookieNonce = readAndClearAuthCookie(req, res, NONCE_COOKIE);
    const rawHistory = readAndClearAuthCookie(req, res, HISTORY_COOKIE);

    // 用户在 Google 那边点了取消
    if (req.query.error) {
        return finish(req, res, {success: false, reason: 'cancelled', redirect, popup});
    }

    try {
        if (!cookieNonce || cookieNonce !== stateData.nonce) {
            throw new errors.BadRequestError({message: 'Google auth nonce mismatch'});
        }

        if (!req.query.code) {
            throw new errors.BadRequestError({message: 'Missing authorization code'});
        }

        const tokens = await googleAuth.exchangeCodeForTokens({
            code: req.query.code,
            callbackUrl: googleAuth.getCallbackUrl(req)
        });

        const profile = googleAuth.decodeAndValidateIdToken(tokens.id_token, stateData.nonce);

        // 首次授权换回的 id_token 常常没有 name(Google 不保证 profile claim 一定在),
        // 这时再拉一次 userinfo 把名字补齐,否则新会员会以空名字落库。
        if (!profile.name && tokens.access_token) {
            try {
                const info = await googleAuth.fetchUserInfo(tokens.access_token);
                profile.name = info.name || '';
                profile.picture = profile.picture || info.picture;
            } catch (err) {
                // 拿不到名字不该挡住登录
                logging.warn(`[google-auth] userinfo lookup failed: ${err.message}`);
            }
        }

        const attribution = await resolveAttribution(rawHistory);
        const {member} = await findOrCreateMember({
            email: profile.email,
            name: profile.name,
            sub: profile.sub,
            attribution
        });

        await models.MemberLoginEvent.add({member_id: member.id});

        if (!member.geolocation && req.ip) {
            try {
                await membersService.api.setMemberGeolocationFromIp(member.email, req.ip);
            } catch (err) {
                // 地理位置查不到不该挡住登录
                logging.warn(`[google-auth] geolocation lookup failed: ${err.message}`);
            }
        }

        await membersService.ssr.createSessionForMember(req, res, member);

        spamPrevention.membersAuth().reset(req.ip, `${member.email}login`);
        // 成功一次就把本 IP 的 Google 回调失败计数清零 —— 限流只该拦真正在刷的人,
        // 不该把共用出口 IP(公司、校园、运营商 NAT)的正常用户累计到封禁
        spamPrevention.googleAuth().reset(req.ip);

        if (config.get('cacheMembersContent:enabled')) {
            try {
                const freeTier = await membersMiddleware.getFreeTier();
                membersMiddleware.setAccessCookies(member, req, res, freeTier);
            } catch (err) {
                // 缓存分层 cookie 是锦上添花,失败不影响登录
                logging.warn(`[google-auth] could not set access cookies: ${err.message}`);
            }
        }

        return finish(req, res, {success: true, redirect, popup});
    } catch (err) {
        if (!err.statusCode || err.statusCode >= 500) {
            logging.error(err);
        } else {
            logging.warn(`[google-auth] sign-in failed: ${err.message}`);
        }

        const reason = err.code === 'SIGNUP_NOT_ALLOWED' ? 'signup_not_allowed' : 'failed';
        return finish(req, res, {success: false, reason, redirect, popup});
    }
};

module.exports = {
    startGoogleAuth,
    googleAuthCallback,

    // 给测试用
    sanitizeRedirect
};
