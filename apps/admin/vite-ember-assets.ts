import type {PluginOption, HtmlTagDescriptor, ResolvedConfig} from 'vite';
import path from 'path';
import fs from 'fs';
import sirv from 'sirv';

const GHOST_ADMIN_PATH = path.resolve(__dirname, '../../ghost/core/core/built/admin');
const GHOST_ADMIN_DIST = path.resolve(__dirname, '../../ghost/admin/dist');
const EMBER_DEV_SERVER = process.env.GHOST_ADMIN_DEV_SERVER ?? 'http://localhost:4200';

function isAbsoluteUrl(url: string): boolean {
    return url.startsWith('http://') ||
           url.startsWith('https://') ||
           url.startsWith('/');
}

function prefixUrl(url: string, base: string): string {
    if (isAbsoluteUrl(url)) return url;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}/${url}`;
}

async function readGhostAdminIndex() {
    try {
        const response = await fetch(EMBER_DEV_SERVER);

        if (!response.ok) {
            throw new Error(`Unexpected response: ${response.status}`);
        }

        return await response.text();
    } catch (error) {
        const indexPath = path.resolve(GHOST_ADMIN_DIST, 'index.html');

        try {
            return fs.readFileSync(indexPath, 'utf-8');
        } catch (fallbackError) {
            console.warn('Failed to read Ghost admin index.html:', fallbackError);
            throw error;
        }
    }
}

// Vite plugin to extract styles and scripts from Ghost admin index.html
export function emberAssetsPlugin() {
    let config: ResolvedConfig;

    return {
        name: 'ember-assets',
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        transformIndexHtml: {
            order: 'post',
            async handler() {
                try {
                    const indexContent = await readGhostAdminIndex();
                    const base = config.base || '/';

                    // Extract stylesheets
                    const styleRegex = /<link[^>]*rel="stylesheet"[^>]*href="([^"]*)"[^>]*>/g;
                    const styles: HtmlTagDescriptor[] = [];
                    let styleMatch;
                    while ((styleMatch = styleRegex.exec(indexContent)) !== null) {
                        styles.push({
                            tag: 'link',
                            attrs: {
                                rel: 'stylesheet',
                                href: prefixUrl(styleMatch[1], base)
                            }
                        });
                    }
                    // Extract scripts
                    const scriptRegex = /<script[^>]*src="([^"]*)"[^>]*><\/script>/g;
                    const scripts: HtmlTagDescriptor[] = [];
                    let scriptMatch;
                    while ((scriptMatch = scriptRegex.exec(indexContent)) !== null) {
                        scripts.push({
                            tag: 'script',
                            injectTo: 'body',
                            attrs: {
                                src: prefixUrl(scriptMatch[1], base)
                            }
                        });
                    }

                    // Extract meta tags
                    const metaRegex = /<meta name="ghost-admin\/config\/environment" content="([^"]*)"[^>]*>/g;
                    const metaTags: HtmlTagDescriptor[] = [];
                    let metaMatch;
                    while ((metaMatch = metaRegex.exec(indexContent)) !== null) {
                        metaTags.push({
                            tag: 'meta',
                            attrs: {
                                name: 'ghost-admin/config/environment',
                                content: metaMatch[1]
                            }
                        });
                    }

                    // Generate the virtual module content
                    return [...styles, ...scripts, ...metaTags];
                } catch (error) {
                    console.warn('Failed to resolve Ghost admin HTML:', error);
                    return;
                }
            }
        },
        configureServer(server) {
            // Serve Ember assets from the filesystem in development
            const assetsMiddleware = sirv(path.resolve(GHOST_ADMIN_PATH, 'assets'), {
                dev: true,
                etag: true
            });

            const base = (server.config.base ?? '/ghost').replace(/\/$/, '');
            const assetsPrefix = `${base}/assets/`;

            server.middlewares.use((req, res, next) => {
                if (!req.url?.startsWith(assetsPrefix)) {
                    next();
                    return;
                }

                const originalUrl = req.url;
                const emberAssetPath = req.url.replace(base, '');

                fetch(new URL(emberAssetPath, EMBER_DEV_SERVER))
                    .then(async (response) => {
                        if (!response.ok) {
                            throw new Error(`Unexpected response: ${response.status}`);
                        }

                        res.statusCode = response.status;

                        const contentType = response.headers.get('content-type');
                        if (contentType) {
                            res.setHeader('content-type', contentType);
                        }

                        const cacheControl = response.headers.get('cache-control');
                        if (cacheControl) {
                            res.setHeader('cache-control', cacheControl);
                        }

                        const body = Buffer.from(await response.arrayBuffer());
                        res.end(body);
                    })
                    .catch(() => {
                        req.url = req.url.replace(assetsPrefix, '/');
                        assetsMiddleware(req, res, () => {
                            req.url = originalUrl;
                            next();
                        });
                    });
            });
        },
        closeBundle() {
            // Only copy assets during production builds
            if (config.command === 'build') {
                try {
                    // All legacy admin assets gets copied to the Ghost core
                    // admin assets folder by the Ember build
                    const ghostAssetsDir = path.resolve(GHOST_ADMIN_PATH, 'assets');

                    // React admin build output (apps/admin/dist/)
                    const reactAssetsDir = path.resolve(config.build.outDir, 'assets');
                    const reactIndexFile = path.resolve(config.build.outDir, 'index.html');
                    
                    // Copy Ember assets to React build output to enable use of
                    // vite preview. This also prevents stale Ember assets from
                    // overwriting fresh ones in the next step.
                    fs.cpSync(ghostAssetsDir, reactAssetsDir, { recursive: true });
                    
                    // Copy combined assets back to Ghost core admin assets folder
                    fs.cpSync(reactAssetsDir, ghostAssetsDir, { 
                        recursive: true,
                        force: true
                    });
                    
                    // Copy React index.html, overwriting the existing index.html
                    const forwardIndexFile = path.resolve(GHOST_ADMIN_PATH, 'index.html');
                    fs.copyFileSync(reactIndexFile, forwardIndexFile);
                } catch (error) {
                    throw new Error(`Failed to copy admin assets: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
    } as const satisfies PluginOption;
}
