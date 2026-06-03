"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyUrlService = void 0;
/* eslint-disable @typescript-eslint/no-require-imports */
const nql = require('@tryghost/nql');
const debug = require('@tryghost/debug')('services:url:lazy');
const logging = require('@tryghost/logging');
const errors = require('@tryghost/errors');
const localUtils = require('../../../shared/url-utils');
// The same expansions used by UrlGenerator so users can write `tag:foo`,
// `author:jane`, etc. and have them rewritten to the underlying field paths.
const EXPANSIONS = [
    { key: 'author', replacement: 'authors.slug' },
    { key: 'tags', replacement: 'tags.slug' },
    { key: 'tag', replacement: 'tags.slug' },
    { key: 'authors', replacement: 'authors.slug' },
    { key: 'primary_tag', replacement: 'primary_tag.slug' },
    { key: 'primary_author', replacement: 'primary_author.slug' }
];
// Same `page:true/false` legacy transformer the UrlGenerator uses, so old
// routes.yaml configs continue to work.
const PAGE_TRANSFORMER = nql.utils.mapKeyValues({
    key: { from: 'page', to: 'type' },
    values: [
        { from: false, to: 'post' },
        { from: true, to: 'page' }
    ]
});
// Map a resource's `type` field (whatever the caller passed) onto the plural
// router resource type. We accept the singular DB column values ('post',
// 'page') as well as the plural router keys, because the migrated callers
// are inconsistent: API responses spread `attrs` (singular), but some
// helpers explicitly tag with the plural router key.
const TYPE_TO_ROUTER_TYPE = {
    post: 'posts',
    posts: 'posts',
    page: 'pages',
    pages: 'pages',
    tag: 'tags',
    tags: 'tags',
    author: 'authors',
    authors: 'authors'
};
/**
 * On-demand URL service. Computes URLs and ownership per-call from the
 * registered router configs instead of holding a precomputed map of every
 * resource. Pure for forward lookups; resolveUrl() takes an optional DB
 * lookup function so reverse lookups stay testable.
 */
class LazyUrlService {
    urlUtils;
    findResource;
    routerConfigs;
    constructor({ urlUtils = localUtils, findResource = null } = {}) {
        this.urlUtils = urlUtils;
        this.findResource = findResource;
        // Router configs in priority order. Position is the registration order.
        this.routerConfigs = [];
    }
    onRouterAddedType(identifier, filter, resourceType, permalink) {
        debug('onRouterAddedType', identifier, resourceType, permalink, filter);
        const config = { identifier, filter, resourceType, permalink, nql: null };
        if (filter) {
            config.nql = nql(filter, { expansions: EXPANSIONS, transformer: PAGE_TRANSFORMER });
        }
        this.routerConfigs.push(config);
    }
    onRouterUpdated() {
        // No state to regenerate. The next URL request reads the (possibly new)
        // router config; in-flight requests that already snapshotted the old
        // config keep using it, which matches the documented atomic-reload
        // behaviour.
    }
    /**
     * Drop all registered routers. Called when routes.yaml is reloaded.
     */
    reset() {
        this.routerConfigs = [];
    }
    hasFinished() {
        return true;
    }
    getUrlForResource(resource, options = {}) {
        const routerType = this._routerTypeOf(resource);
        if (!routerType) {
            return this._formatPath('/404/', options);
        }
        const candidates = this.routerConfigs.filter(c => c.resourceType === routerType);
        for (const config of candidates) {
            // Warn loudly when a caller passes a resource that's missing
            // the relations a tag- or author-filtered router needs. The
            // URL silently falls through to /404/ on those routes; the
            // log lets operators alert on any caller that hasn't been
            // inflated with withRelated: ['tags', 'authors'].
            this._warnIfThin(config, resource, routerType);
            // NQL filters are evaluated against the original resource (with
            // its singular DB `type` field intact) because the page:true/false
            // transformer rewrites to type:'post'/'page'.
            if (this._matchesFilter(config, resource)) {
                const path = this.urlUtils.replacePermalink(config.permalink, resource);
                return this._formatPath(path, options);
            }
        }
        return this._formatPath('/404/', options);
    }
    /**
     * Warn when a caller passes a thin resource (missing tags/authors)
     * against a router whose filter references those relations. The
     * filter eval will fail silently and the URL will resolve to /404/.
     * Detection is conservative: only fires when the router filter
     * actually references the relation, so a tag-less router (`filter:
     * featured:true`) doesn't log for a tag-less resource.
     */
    _warnIfThin(config, resource, routerType) {
        if (!config.filter) {
            return;
        }
        const needsTags = /\btags?\b|\bprimary_tag\b/.test(config.filter);
        const needsAuthors = /\bauthors?\b|\bprimary_author\b/.test(config.filter);
        const r = resource;
        const missingTags = needsTags && !Array.isArray(r.tags);
        const missingAuthors = needsAuthors && !Array.isArray(r.authors);
        if (!missingTags && !missingAuthors) {
            return;
        }
        const missing = [missingTags && 'tags', missingAuthors && 'authors']
            .filter(Boolean);
        logging.error(new errors.InternalServerError({
            message: 'Thin resource passed to LazyUrlService.getUrlForResource',
            code: 'LAZY_URL_THIN_RESOURCE',
            errorDetails: {
                resourceType: routerType,
                resourceId: resource.id,
                routerIdentifier: config.identifier,
                filter: config.filter,
                missing
            }
        }));
    }
    ownsResource(routerIdentifier, resource) {
        const config = this.routerConfigs.find(c => c.identifier === routerIdentifier);
        if (!config || !resource) {
            return false;
        }
        const routerType = this._routerTypeOf(resource);
        if (config.resourceType !== routerType) {
            return false;
        }
        return this._matchesFilter(config, resource);
    }
    /**
     * Translate the resource's `type` field into the plural router resource
     * type (`'posts'` / `'pages'` / `'tags'` / `'authors'`). Returns `null`
     * when the type is missing or unrecognised.
     */
    _routerTypeOf(resource) {
        if (!resource || !resource.type) {
            return null;
        }
        return TYPE_TO_ROUTER_TYPE[resource.type] || null;
    }
    /**
     * Resolve a URL path to a resource record. Iterates router configs in
     * priority order, pattern-matching the path against each permalink
     * template, querying the database for a matching resource, and verifying
     * any NQL filter still matches for posts.
     */
    async resolveUrl(urlPath) {
        if (!this.findResource) {
            return null;
        }
        for (const config of this.routerConfigs) {
            const params = this._matchPermalink(config.permalink, urlPath);
            if (!params) {
                continue;
            }
            const resource = await this.findResource(config.resourceType, params);
            if (!resource) {
                continue;
            }
            // For posts/pages with NQL filters, confirm the DB record still
            // satisfies the filter. The match runs against the raw record
            // (with its singular `type` column) because the page:true/false
            // transformer rewrites to type:'post'/'page'.
            if (config.nql && !this._matchesFilter(config, resource)) {
                continue;
            }
            return Object.assign({}, resource, { type: config.resourceType });
        }
        return null;
    }
    _matchesFilter(config, resource) {
        if (!config.nql) {
            return true;
        }
        try {
            return !!config.nql.queryJSON(resource);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            debug('NQL match failed', config.filter, message);
            return false;
        }
    }
    _formatPath(path, options) {
        if (options.absolute) {
            return this.urlUtils.createUrl(path, options.absolute);
        }
        if (options.withSubdirectory) {
            return this.urlUtils.createUrl(path, false, true);
        }
        return path;
    }
    /**
     * Match a Ghost permalink template (e.g. `/:slug/`,
     * `/:year/:month/:slug/`) against a URL path and extract the named
     * fields. Ghost's RouteSettings validator rewrites `{field}` placeholders
     * into `:field` form before they reach the URL service, so this parser
     * works on the `:field` syntax.
     *
     * Implementation: walk the permalink and path one segment at a time.
     * Each segment must be either a literal match or a single placeholder.
     * Mixing literals and placeholders inside a segment is unsupported and
     * not a documented Ghost feature; rejecting it here also keeps us out of
     * regex-backtracking territory entirely.
     */
    _matchPermalink(permalink, urlPath) {
        if (typeof permalink !== 'string' || typeof urlPath !== 'string') {
            return null;
        }
        const permalinkSegments = permalink.split('/');
        const pathSegments = urlPath.split('/');
        if (permalinkSegments.length !== pathSegments.length) {
            return null;
        }
        const params = {};
        for (let i = 0; i < permalinkSegments.length; i += 1) {
            const templateSegment = permalinkSegments[i];
            const pathSegment = pathSegments[i];
            if (templateSegment.startsWith(':')) {
                const fieldName = templateSegment.slice(1);
                if (!/^\w+$/.test(fieldName) || pathSegment.length === 0) {
                    return null;
                }
                try {
                    params[fieldName] = decodeURIComponent(pathSegment);
                }
                catch {
                    // Malformed %-escapes (e.g. "/foo%ZZ/") throw URIError;
                    // treat as a non-match rather than crash the request.
                    return null;
                }
            }
            else if (templateSegment !== pathSegment) {
                return null;
            }
        }
        return params;
    }
}
exports.LazyUrlService = LazyUrlService;
module.exports = LazyUrlService;
