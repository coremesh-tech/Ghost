// RATUS: Portal 里的「使用 Google 登录」按钮。
//
// 流程:点按钮 -> window.open 弹窗打开 /members/api/auth/google/start
//        -> 用户在 Google 选账号 -> 回调页种好 session cookie 后 postMessage 并自关
//        -> 这里收到消息刷新页面,SSR 就是登录态了。
//
// 注意 Portal 的 JS 跑在**顶层页面**(只有 DOM 节点被 portal 进 iframe),
// 所以这里的 window / window.open / location 都是主站页面,没有 iframe 的坑。
//
// 按钮的结构、类名和样式来自 Google 官方的按钮生成器(gsi-material-button),
// 未作改动 —— 只在最后追加了一小段适配 Portal 宽度的覆盖规则。
// 图标同样是官方素材(../../images/icons/google.svg)。
import {useContext, useEffect, useRef, useState} from 'react';
import AppContext from '../../app-context';
import GoogleIcon from '../../images/icons/google.svg?react';
import {getUrlHistory} from '../../utils/helpers';
import {t} from '../../utils/i18n';
import {trackEvent} from '../../utils/tracker';

const POPUP_NAME = 'ghost-google-auth';
const POPUP_FEATURES = 'width=500,height=650,menubar=no,toolbar=no,location=no,status=no';
// 归因用的浏览历史:只带最近几条,URL 太长会被服务端丢弃
const MAX_HISTORY_ENTRIES = 10;
const MAX_HISTORY_CHARS = 3000;

export const GoogleSignInButtonStyles = `
    .gsi-material-button {
        -moz-user-select: none;
        -webkit-user-select: none;
        -ms-user-select: none;
        -webkit-appearance: none;
        background-color: WHITE;
        background-image: none;
        border: 1px solid #747775;
        -webkit-border-radius: 4px;
        border-radius: 4px;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
        color: #1f1f1f;
        cursor: pointer;
        font-family: 'Roboto', arial, sans-serif;
        font-size: 14px;
        height: 40px;
        letter-spacing: 0.25px;
        outline: none;
        overflow: hidden;
        padding: 0 12px;
        position: relative;
        text-align: center;
        -webkit-transition: background-color .218s, border-color .218s, box-shadow .218s;
        transition: background-color .218s, border-color .218s, box-shadow .218s;
        vertical-align: middle;
        white-space: nowrap;
        width: auto;
        max-width: 400px;
        min-width: min-content;
    }

    .gsi-material-button .gsi-material-button-icon {
        height: 20px;
        margin-right: 10px;
        min-width: 20px;
        width: 20px;
    }

    .gsi-material-button .gsi-material-button-content-wrapper {
        -webkit-align-items: center;
        align-items: center;
        display: flex;
        -webkit-flex-direction: row;
        flex-direction: row;
        -webkit-flex-wrap: nowrap;
        flex-wrap: nowrap;
        height: 100%;
        justify-content: space-between;
        position: relative;
    }

    .gsi-material-button .gsi-material-button-contents {
        -webkit-flex-grow: 1;
        flex-grow: 1;
        font-family: 'Roboto', arial, sans-serif;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: top;
    }

    .gsi-material-button .gsi-material-button-state {
        -webkit-transition: opacity .218s;
        transition: opacity .218s;
        bottom: 0;
        left: 0;
        opacity: 0;
        position: absolute;
        right: 0;
        top: 0;
    }

    .gsi-material-button:disabled {
        cursor: default;
        background-color: #ffffff61;
        border-color: #1f1f1f1f;
    }

    .gsi-material-button:disabled .gsi-material-button-contents {
        opacity: 38%;
    }

    .gsi-material-button:disabled .gsi-material-button-icon {
        opacity: 38%;
    }

    .gsi-material-button:not(:disabled):active .gsi-material-button-state,
    .gsi-material-button:not(:disabled):focus .gsi-material-button-state {
        background-color: #303030;
        opacity: 12%;
    }

    .gsi-material-button:not(:disabled):hover {
        -webkit-box-shadow: 0 1px 2px 0 rgba(60, 64, 67, .30), 0 1px 3px 1px rgba(60, 64, 67, .15);
        box-shadow: 0 1px 2px 0 rgba(60, 64, 67, .30), 0 1px 3px 1px rgba(60, 64, 67, .15);
    }

    .gsi-material-button:not(:disabled):hover .gsi-material-button-state {
        background-color: #303030;
        opacity: 8%;
    }

    /* ---------------------------------------------------------------
       RATUS 适配层:以上是 Google 官方样式,原样保留;以下只做三件事 ——
       1) 和 Portal 主按钮等宽(官方默认 width:auto + max-width:400px,
          在 420px 宽的表单里会比主按钮窄一圈,看着就是没对齐)
       2) 文字相对整个按钮居中(官方把图标算进流内,contents 只在剩余
          空间里居中,视觉上文字会右偏约 15px)
       3) 登录/注册两个弹窗用同一套纵向间距
       --------------------------------------------------------------- */
    .gh-portal-google-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        gap: 12px;
    }

    .gh-portal-google-wrapper .gsi-material-button {
        width: 100%;
        max-width: none;
    }

    /* 图标脱离文档流钉在左侧,文字才能相对按钮真正居中 */
    .gh-portal-google-wrapper .gsi-material-button-content-wrapper {
        justify-content: center;
    }

    .gh-portal-google-wrapper .gsi-material-button-icon {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        margin-right: 0;
    }

    .gh-portal-google-wrapper .gsi-material-button-contents {
        flex-grow: 0;
        max-width: 100%;
        text-align: center;
    }

    /* 注册页的按钮区对齐登录页的 footer:同样的 flex column + 12px 间距。
       登录页用的是 footer.gh-portal-signin-footer,注册页原本是个普通
       block 容器,所以两边的疏密才不一样。 */
    .gh-portal-signup-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        gap: 12px;
    }

    .gh-portal-signup-actions .gh-portal-signup-message,
    footer.gh-portal-signin-footer .gh-portal-signup-message {
        margin: 0;
    }

    /* 注册页最后一个输入框到按钮的距离,对齐登录页。
       原生是 .signup .gh-portal-input-section:last-of-type { margin-bottom: 40px },
       而登录页是 .gh-portal-section margin 归零 + footer padding-top:12px。
       这里用更高的选择器权重(4 个 class 级)盖掉原生的 3 个。 */
    .gh-portal-content.signup .gh-portal-input-section:last-of-type {
        margin-bottom: 12px;
    }

    .gh-portal-google-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        color: var(--grey8);
        font-size: 1.3rem;
        line-height: 1;
    }

    .gh-portal-google-divider::before,
    .gh-portal-google-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--grey12);
    }

`;

/**
 * Ghost 可能装在子目录下,所以路径前缀要从 site.url 里取 pathname,
 * 但**不**带 origin —— 站点是多域名的,会话 cookie 必须落在用户当前访问的域名上。
 */
const getMembersPath = (site, path) => {
    let prefix = '';
    try {
        prefix = new URL(site?.url || window.location.origin).pathname.replace(/\/$/, '');
    } catch (e) {
        prefix = '';
    }
    return `${prefix}${path}`;
};

export default function GoogleSignInButton({label}) {
    const {site, doAction} = useContext(AppContext);
    const [isRunning, setIsRunning] = useState(false);
    const popupRef = useRef(null);
    const pollRef = useRef(null);
    const doneRef = useRef(false);

    const cleanup = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        popupRef.current = null;
    };

    useEffect(() => {
        const onMessage = (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            const data = event.data || {};
            if (data.type !== 'ghost-google-auth' || doneRef.current) {
                return;
            }

            doneRef.current = true;
            cleanup();

            if (data.success) {
                // 整页刷新,让 SSR 带上登录态(和 magic link 登录后的行为一致)
                window.location.reload();
                return;
            }

            setIsRunning(false);

            // 用户在 Google 那边主动取消,不算错误,静默恢复
            if (data.reason === 'cancelled') {
                return;
            }

            // 和 signin:failed 一样走右上角通知,不自动消失、可手动关闭
            doAction('showPopupNotification', {
                action: 'google-signin:failed',
                status: 'error',
                autoHide: false,
                message: data.reason === 'signup_not_allowed'
                    ? t('This site is invite-only, contact the owner for access.')
                    : t('There was an error signing you in, please try again.')
            });
        };

        window.addEventListener('message', onMessage);
        return () => {
            window.removeEventListener('message', onMessage);
            cleanup();
        };
    }, []);

    // 注册归因:把 Portal 记录的浏览历史带给服务端,让 Google 注册的会员
    // 和邮箱注册一样能在后台看到来源。取不到就算了,不影响登录。
    const historyParam = () => {
        try {
            const history = getUrlHistory();
            if (!Array.isArray(history) || history.length === 0) {
                return '';
            }
            const encoded = encodeURIComponent(JSON.stringify(history.slice(-MAX_HISTORY_ENTRIES)));
            return encoded.length > MAX_HISTORY_CHARS ? '' : `&h=${encoded}`;
        } catch (e) {
            return '';
        }
    };

    const startUrl = (popup) => {
        const redirect = `${window.location.pathname}${window.location.search}`;
        return getMembersPath(site, '/members/api/auth/google/start') +
            `?popup=${popup ? '1' : '0'}&r=${encodeURIComponent(redirect)}` +
            historyParam();
    };

    const onClick = () => {
        if (isRunning) {
            return;
        }

        doneRef.current = false;
        trackEvent('google_signin_click', {source: 'portal'});

        const popup = window.open(startUrl(true), POPUP_NAME, POPUP_FEATURES);

        // 弹窗被拦截:退回整页跳转,别让用户点了没反应
        if (!popup) {
            window.location.href = startUrl(false);
            return;
        }

        popupRef.current = popup;
        setIsRunning(true);

        // 兜底:用户手动关掉弹窗、或 postMessage 没送达时,主动确认一次会话状态
        pollRef.current = setInterval(async () => {
            if (!popupRef.current || !popupRef.current.closed || doneRef.current) {
                return;
            }

            doneRef.current = true;
            cleanup();

            try {
                const res = await window.fetch(getMembersPath(site, '/members/api/member'), {
                    credentials: 'include'
                });
                const member = res.ok ? await res.json() : null;
                if (member && member.email) {
                    window.location.reload();
                    return;
                }
            } catch (e) {
                // 探测失败就当没登上,让用户重试
            }

            setIsRunning(false);
        }, 500);
    };

    return (
        <div className='gh-portal-google-wrapper'>
            <div className='gh-portal-google-divider'>{t('or')}</div>
            <button
                type='button'
                className='gsi-material-button'
                data-test-button='google-signin'
                disabled={isRunning}
                onClick={onClick}
            >
                <div className='gsi-material-button-state'></div>
                <div className='gsi-material-button-content-wrapper'>
                    <div className='gsi-material-button-icon'>
                        <GoogleIcon />
                    </div>
                    <span className='gsi-material-button-contents'>
                        {isRunning ? t('Waiting for Google…') : (label || t('Sign in with Google'))}
                    </span>
                </div>
            </button>
        </div>
    );
}
