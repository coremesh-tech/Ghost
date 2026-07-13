const logging = require('@tryghost/logging');
const createKeypair = require('keypair');
const config = require('../../../shared/config');

class MembersConfigProvider {
    /**
     * @param {object} options
     * @param {{get: (key: string) => any}} options.settingsCache
     * @param {{getDefaultEmailDomain(): string, getMembersSupportAddress(): string, getNoReplyAddress(): string, isStripeConnected(): boolean}} options.settingsHelpers
     * @param {any} options.urlUtils
     */
    constructor({settingsCache, settingsHelpers, urlUtils}) {
        this._settingsCache = settingsCache;
        this._settingsHelpers = settingsHelpers;
        this._urlUtils = urlUtils;
    }

    get defaultEmailDomain() {
        return this._settingsHelpers.getDefaultEmailDomain();
    }

    /**
     * @deprecated Use settingsHelpers.getNoReplyAddress or settingsHelpers.getMembersSupportAddress instead
     */
    getEmailFromAddress() {
        // Individual from addresses are set per newsletter - this is the fallback address
        return this._settingsHelpers.getNoReplyAddress();
    }

    /**
     * @deprecated Use settingsHelpers.getNoReplyAddress or settingsHelpers.getMembersSupportAddress instead
     */
    getEmailSupportAddress() {
        return this._settingsHelpers.getMembersSupportAddress();
    }

    /**
     * @deprecated Use settingsHelpers.isStripeConnected instead
     */
    isStripeConnected() {
        return this._settingsHelpers.isStripeConnected();
    }

    getAllowSelfSignup() {
        // Free signups are allowed only if the site subscription is set to "Full-access"
        // It is blocked for "Invite-only", "Paid-members-only" and "None" accesses
        return this._settingsCache.get('members_signup_access') === 'all';
    }

    getTokenConfig() {
        const membersApiUrl = this._urlUtils.urlFor({relativeUrl: '/members/api'}, true);

        let privateKey = this._settingsCache.get('members_private_key');
        let publicKey = this._settingsCache.get('members_public_key');

        if (!privateKey || !publicKey) {
            logging.warn('Could not find members_private_key, using dynamically generated keypair');
            const keypair = createKeypair({bits: 1024});
            privateKey = keypair.private;
            publicKey = keypair.public;
        }

        return {
            issuer: membersApiUrl,
            publicKey,
            privateKey
        };
    }

    /**
     * @param {string} token
     * @param {string} type - also known as "action", e.g. "signin" or "signup"
     * @param {string} [referrer] - optional URL for redirecting to after signin
     * @param {string} [otcVerification] - optional for verifying an OTC signin redirect
     * @returns {string}
     */
    getSigninURL(token, type, referrer, otcVerification) {
        const siteUrl = this._urlUtils.urlFor({relativeUrl: '/members/'}, true);
        const signinURL = new URL(siteUrl);

        // 多域名支持:magic link 默认用 config.url 的域名。若 referrer(发起页,取自
        // Referer/redirect,即用户当前访问的域名)带了一个「白名单内」的域名,就把
        // magic link 的域名改成该发起域名,使用户点邮件链接回到他发起注册/登录的域名。
        //
        // 安全红线:referrer 是客户端可控值。绝不能无条件改写 —— 否则攻击者可让带有效
        // token 的链接指向任意域名,导致 token 泄露/账号劫持。因此只允许改写成:
        //   1) 与 config.url 同域(等价于不改),或
        //   2) config 的 alternativeDomains 白名单内的域名。
        // 白名单外或 referrer 非法 → 保持 config.url。
        if (referrer) {
            try {
                const referrerUrl = new URL(referrer);
                const isHttp = referrerUrl.protocol === 'http:' || referrerUrl.protocol === 'https:';
                const referrerHost = referrerUrl.host.toLowerCase();
                const configHost = signinURL.host.toLowerCase();
                const allowedHosts = (config.get('alternativeDomains') || [])
                    .map(host => String(host).toLowerCase());
                const isAllowedHost = referrerHost === configHost || allowedHosts.includes(referrerHost);

                if (isHttp && isAllowedHost) {
                    signinURL.protocol = referrerUrl.protocol;
                    signinURL.host = referrerUrl.host;
                }
            } catch (err) {
                // referrer 非法 URL → 保持 config.url,不改写
            }
        }

        signinURL.searchParams.set('token', token);
        signinURL.searchParams.set('action', type);
        if (referrer) {
            signinURL.searchParams.set('r', referrer);
        }
        if (otcVerification) {
            signinURL.searchParams.set('otc_verification', otcVerification);
        }
        return signinURL.toString();
    }
}

module.exports = MembersConfigProvider;
