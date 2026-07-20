import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './app';

const ROOT_DIV_ID = 'ghost-portal-root';

function addRootDiv() {
    const elem = document.createElement('div');
    elem.id = ROOT_DIV_ID;
    elem.setAttribute('data-testid', 'portal-root');
    document.body.appendChild(elem);
}

function getSiteData() {
    /**
     * @type {HTMLElement}
     */
    const scriptTag = document.querySelector('script[data-ghost]');
    if (scriptTag) {
        const siteI18nEnabled = scriptTag.dataset.i18n === 'true';
        const siteUrl = scriptTag.dataset.ghost;
        const apiKey = scriptTag.dataset.key;
        const apiUrl = scriptTag.dataset.api;
        const locale = scriptTag.dataset.locale; // not providing a fallback here but will do it within the app.
        return {siteUrl, apiKey, apiUrl, siteI18nEnabled, locale};
    }
    return {};
}

function handleTokenUrl() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('token')) {
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.href);
    }
}

function init() {
    // const customSiteUrl = getSiteUrl();
    const {siteUrl: customSiteUrl, apiKey, apiUrl, siteI18nEnabled, locale} = getSiteData();

    // 多域名支持:members 相关请求(session/member/magic-link 等)必须走「当前访问域名」,
    // 否则会跨域到 data-ghost(config.url),host-only 的会话 cookie 带不过去 → Portal
    // 误判未登录(点头像弹登录框而非账户)。这里把 members 用的 siteUrl 改成
    // 「当前 origin + 配置里的子路径」:既跟随当前域名,又兼容子目录部署。
    // content API(apiUrl)是公开只读、无需 cookie,保持配置值不变。
    // 单域名场景下 window.location.origin === config.url,行为不变。
    let siteUrl = customSiteUrl || window.location.origin;
    try {
        const configuredPath = customSiteUrl ? new URL(customSiteUrl).pathname : '/';
        siteUrl = window.location.origin + (configuredPath === '/' ? '' : configuredPath.replace(/\/$/, ''));
    } catch (e) {
        siteUrl = window.location.origin;
    }

    addRootDiv();
    handleTokenUrl();

    ReactDOM.render(
        <React.StrictMode>
            <App siteUrl={siteUrl} customSiteUrl={customSiteUrl} apiKey={apiKey} apiUrl={apiUrl} siteI18nEnabled={siteI18nEnabled} locale={locale} />
        </React.StrictMode>,
        document.getElementById(ROOT_DIV_ID)
    );
}

init();
