import type { Plugin, ProxyOptions } from "vite";
import type { IncomingMessage } from "http";
import { getSubdir, GHOST_URL } from "./vite.config";

/**
 * Resolves the configured Ghost site URL by calling the admin api site endpoint
 * with retries (up to 20 seconds).
 */
async function resolveGhostSiteUrl() {
    const MAX_ATTEMPTS = 20;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const siteEndpoint = new URL('ghost/api/admin/site/', GHOST_URL);
            const response = await fetch(siteEndpoint);
            const data = (await response.json()) as { site: { url: string } };
            return {
                url: data.site.url,
                host: new URL(data.site.url).host,
            };
        } catch (error) {
            if (attempt === MAX_ATTEMPTS) throw error;
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
    }

    throw new Error("Failed to resolve Ghost site URL");
}

/**
 * Creates proxy configuration for Ghost Admin API requests. Rewrites cookies
 * and headers to work with Ghost's security middleware.
 */
function createAdminApiProxy(site: {
    url: string;
    host: string;
}, rewriteSecureCookies: boolean): Record<string, ProxyOptions> {
    // If the dev server is running on HTTP while backend is HTTPS,
    // strip Secure and SameSite=None so the browser accepts the cookie.
    // If dev server is HTTPS, keep cookies as-is.
    const maybeRewriteCookies = (proxyRes: IncomingMessage) => {
        if (!rewriteSecureCookies) {
            return;
        }
        const cookies = proxyRes.headers["set-cookie"];
        if (Array.isArray(cookies)) {
            proxyRes.headers["set-cookie"] = cookies.map((cookie) => {
                return cookie
                    .split(";")
                    .filter((v) => v.trim().toLowerCase() !== "secure")
                    .filter((v) => v.trim().toLowerCase() !== "samesite=none")
                    .join("; ");
            });
        }
    };

    const subdir = getSubdir();

    const adminOrigin = new URL(site.url).origin;
    const adminReferer = `${adminOrigin}${getSubdir()}/ghost/`;

    return {
        [`^${subdir}/ghost/api/.*`]: {
            target: site.url,
            changeOrigin: true,
            followRedirects: true,
            autoRewrite: true,
            cookieDomainRewrite: {
                "*": site.host,
            },
            configure(proxy) {
                proxy.on("proxyRes", maybeRewriteCookies);
                proxy.on("proxyReq", (proxyReq) => {
                    try {
                        // Ensure backend sees Admin origin to satisfy CSRF checks
                        proxyReq.setHeader('origin', adminOrigin);
                        proxyReq.setHeader('referer', adminReferer);
                    } catch (_) {
                        // ignore
                    }
                });
            },
        },
    };
}

/**
 * Creates proxy configuration for Ember CLI live reload script.
 */
function createEmberLiveReloadProxy(): Record<string, ProxyOptions> {
    return {
        "^/ember-cli-live-reload.js": {
            target: "http://localhost:4200",
            changeOrigin: true,
        },
    };
}

/**
 * Vite plugin that injects proxy configurations for:
 * 1. Ghost Admin API - proxies /ghost/api requests to the Ghost backend
 * 2. Ember Live Reload - proxies ember-cli-live-reload.js to Ember dev server
 */
export function ghostBackendProxyPlugin(): Plugin {
    let siteUrl!: { url: string; host: string };
    let devIsHttps = false;

    return {
        name: "ghost-backend-proxy",

        async configResolved(config) {
            // Only resolve backend URL for dev/preview, not for builds or tests
            if (config.command !== 'serve' || config.mode === 'test') return;

            try {
                // We expect this to succeed immediately, but if the backend
                // server is getting started, it might need some time.
                // In that case, this lets the user know in case we're barking
                // up the wrong tree (aka the GHOST_URL is wrong.)
                const timeout = setTimeout(() => {
                    config.logger.info(`Trying to reach Ghost Admin API at ${GHOST_URL}...`);
                }, 1000);

                siteUrl = await resolveGhostSiteUrl();
                clearTimeout(timeout);

                config.logger.info(`👻 Using backend url: ${siteUrl.url}`);
                // Detect dev server protocol (https enabled) for cookie handling
                // Will be re-checked in configureServer
            } catch (error) {
                config.logger
                    .error(`Could not reach Ghost Admin API at: ${GHOST_URL}

Ensure the Ghost backend is running. If needed, set the GHOST_URL environment variable to the correct URL.
    `);

                throw error;
            }
        },

        configureServer(server) {
            if (!siteUrl) return;
            devIsHttps = Boolean(server.config.server.https);

            server.config.server.proxy = {
                ...server.config.server.proxy,
                ...createAdminApiProxy(siteUrl, !devIsHttps),
                ...createEmberLiveReloadProxy(),
            };
        },

        configurePreviewServer(server) {
            if (!siteUrl) return;
            const previewIsHttps = Boolean(server.config.preview.https);

            server.config.preview.proxy = {
                ...server.config.preview.proxy,
                ...createAdminApiProxy(siteUrl, !previewIsHttps),
            };
        },
    } as const satisfies Plugin;
}
