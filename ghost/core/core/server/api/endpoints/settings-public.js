const settingsCache = require('../../../shared/settings-cache');
const labs = require('../../../shared/labs');
const urlUtils = require('../../../shared/url-utils');
const ghostVersion = require('@tryghost/version');
const googleAuth = require('../../services/members/google-auth'); // RATUS

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'settings',

    browse: {
        headers: {
            cacheInvalidate: false
        },
        permissions: true,
        query() {
            // @TODO: decouple settings cache from API knowledge
            // The controller fetches models (or cached models) and the API frame for the target API version formats the response.
            return Object.assign({},
                settingsCache.getPublic(), {
                    url: urlUtils.urlFor('home', true),
                    version: ghostVersion.safe,
                    labs: labs.getAll(),
                    // Portal 靠这个开关决定要不要渲染 "Continue with Google"。
                    // 必须放在 Content API 的 settings 里 —— Portal 的 site 数据来自
                    // /ghost/api/content/settings/,不是 /members/api/site/。
                    google_auth_enabled: googleAuth.isEnabled()
                }
            );
        }
    }
};

module.exports = controller;
