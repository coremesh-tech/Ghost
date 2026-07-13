import AuthenticatedRoute from 'ghost-admin/routes/authenticated';
import InfinityModel from 'ember-infinity/lib/infinity-model';
import RSVP from 'rsvp';
import classic from 'ember-classic-decorator';
import {action} from '@ember/object';
import {assign} from '@ember/polyfills';
import {isBlank} from '@ember/utils';
import {inject as service} from '@ember/service';

@classic
class PostsInfinityModel extends InfinityModel {
    @service postAnalytics;
    @service predictMixin;
    @service feature;
    @service settings;
    @service session;

    async afterInfinityModel(posts) {
        const promises = [];

        // Fetch predict mixin submissions for contributors
        if ((this.session.user.isContributor || this.session.user.isAdmin) && posts.length > 0) {
            const postIds = posts.map(post => post.id);
            promises.push(this.predictMixin.loadStaffPostSubmissions(postIds));
        }

        const publishedPosts = posts.filter(post => ['published', 'sent'].includes(post.status));
        if (publishedPosts.length > 0) {
            // Fetch visitor counts if web analytics is enabled
            if (this.settings.webAnalyticsEnabled) {
                const postUuids = publishedPosts.map(post => post.uuid);
                promises.push(this.postAnalytics.loadVisitorCounts(postUuids));
            }
            
            // Fetch member counts if member tracking is enabled
            if (this.settings.membersTrackSources) {
                promises.push(this.postAnalytics.loadMemberCounts(publishedPosts));
            }

            promises.push(this.postAnalytics.loadReadCounts(publishedPosts));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
        
        return posts;
    }
}

export default class PostsRoute extends AuthenticatedRoute {
    @service infinity;
    @service router;
    @service feature;
    @service postAnalytics;
    @service predictMixin;
    @service settings;

    queryParams = {
        type: {refreshModel: true},
        visibility: {refreshModel: true},
        author: {refreshModel: true},
        tag: {refreshModel: true},
        order: {refreshModel: true},
        predictStatus: {refreshModel: true},
        refresh: {refreshModel: true}
    };

    modelName = 'post';
    perPage = 30;

    constructor() {
        super(...arguments);

        // if we're already on this route and we're transiting _to_ this route
        // then the filters are being changed and we shouldn't create a new
        // browser history entry
        // see https://github.com/TryGhost/Ghost/issues/11057
        this.router.on('routeWillChange', (transition) => {
            if (transition.to && (this.routeName === 'posts' || this.routeName === 'pages')) {
                let toThisRoute = transition.to.find(route => route.name === this.routeName);
                if (transition.from && transition.from.name === this.routeName && toThisRoute) {
                    transition.method('replace');
                }
            }
        });
    }

    async model(params) {
        // Reset analytics cache every time we load the posts index to ensure fresh data
        if (this.settings.webAnalyticsEnabled || this.settings.membersTrackSources) {
            this.postAnalytics.reset();
        }

        if (this.session.user.isContributor || this.session.user.isAdmin) {
            this.predictMixin.reset();
        }

        const user = this.session.user;
        let filterParams = {tag: params.tag, visibility: params.visibility};
        let paginationParams = {
            perPageParam: 'limit',
            totalPagesParam: 'meta.pagination.pages'
        };

        // type filters are actually mapping statuses
        assign(filterParams, this._getTypeFilters(params.type));

        // predictStatus 命中时,匹配到的 post id 列表(可能很多)。
        // 不再塞进 filter(会让 GET /posts 的 URL 超长 → Nginx 414),
        // 而是记下来,后面用 _fetchPostsByIdsBatched 分批查询。
        let predictMatchedIds = null;

        // Handle predictStatus filter
        if (params.predictStatus && params.predictStatus !== 'all') {
            // Adjust status filter based on predictStatus:
            // 1 & 2. IDLE or CHECK: force status to be draft
            // 3. PASSED: force status to be published
            if (params.predictStatus === 'IDLE' || params.predictStatus === 'CHECK') {
                filterParams.status = 'draft';
            } else if (params.predictStatus === 'PASSED') {
                filterParams.status = 'published';
            }

            // First, get the list of all posts matching the current base filter (e.g. all drafts)
            // To avoid loading the full post models, we just query for their IDs.
            // 用与最终展示一致的 order 取候选,这样过滤后的 id 顺序即展示顺序。
            let preFilterParams = {...filterParams};
            preFilterParams.limit = 'all';
            preFilterParams.fields = 'id';
            preFilterParams.order = params.order || (filterParams.status === 'published' ? 'published_at desc' : 'updated_at desc');

            const postsInStatus = await this.store.query('post', preFilterParams);
            const allCandidateIds = postsInStatus.map(p => p.id);

            if (allCandidateIds.length === 0) {
                filterParams.id = 'none';
            } else {
                // Now query the prediction mixin API for THESE specific IDs using the updated fetch method
                await this.predictMixin.fetchPostSubmissionsByStatus(allCandidateIds);
                
                // Now filter the IDs based on what the predictMixin has in its cache
                const postIds = allCandidateIds.filter((id) => {
                    const submission = this.predictMixin.getSubmission(id);
                    
                    if (params.predictStatus === 'IDLE') {
                        // A post is IDLE if it has NO submission OR its submission_status is 'IDLE'
                        if (!submission || !submission.submission_status) {
                            return true;
                        }
                        return String(submission.submission_status).toUpperCase() === 'IDLE';
                    } else {
                        // For CHECK and PASSED, they MUST have a matching submission
                        if (!submission || !submission.submission_status) {
                            return false;
                        }
                        return String(submission.submission_status).toUpperCase() === params.predictStatus;
                    }
                });

                if (postIds.length === 0) {
                    filterParams.id = 'none';
                } else {
                    // 记下匹配 id,稍后分批查询(不进 URL filter)
                    predictMatchedIds = postIds;
                }
            }
        }
        // 4. If predictStatus is 'all' or not set, we do nothing and let it fall back to default logic

        if (params.type === 'featured') {
            filterParams.featured = true;
        }

        // authors and contributors can only view their own posts
        if (user.isAuthor) {
            filterParams.authors = user.slug;
        } else if (user.isContributor) {
            filterParams.authors = user.slug;
            // otherwise we need to filter by author if present
        } else if (params.author) {
            filterParams.authors = params.author;
        }

        if (params.predictStatus && params.predictStatus !== 'all') {
            const users = await this.store.query('user', {limit: 'all'});
            const contributorSlugs = users.filterBy('isContributor', true).mapBy('slug');
            
            if (contributorSlugs.length === 0) {
                filterParams.id = 'none';
            } else if (filterParams.authors) {
                if (!contributorSlugs.includes(filterParams.authors)) {
                    filterParams.id = 'none';
                }
            } else {
                filterParams.authors = `[${contributorSlugs.join(',')}]`;
            }
        }

        // predictStatus 命中:分批按 id 查询 posts,避免单条 GET URL 过长(Nginx 414)。
        // 这条路径不走 infinity model,一次性把匹配到的 posts 加载好,以纯数组返回,
        // 模板用 {{#each}} 渲染即可;infinity loader 由 predictBatched 标志屏蔽。
        if (predictMatchedIds && predictMatchedIds.length > 0) {
            const order = params.order || (filterParams.status === 'published' ? 'published_at desc' : 'updated_at desc');
            const posts = await this._fetchPostsByIdsBatched(predictMatchedIds, {filterParams, order});
            const batchedModels = {predictBatched: true};
            if (filterParams.status === 'published') {
                batchedModels.publishedAndSentInfinityModel = posts;
            } else {
                batchedModels.draftInfinityModel = posts;
            }
            return RSVP.hash(batchedModels);
        }

        let perPage = this.perPage;

        let filterStatuses = filterParams.status;
        if (filterStatuses === 'all') {
            filterStatuses = ['draft', 'published', 'scheduled', 'sent'];
        }
        const filterStatusesArray = Array.isArray(filterStatuses) ? filterStatuses : filterStatuses.split(',');
        
        let queryParams = {allFilter: this._filterString({...filterParams})}; // pass along the parent filter so it's easier to apply the params filter to each infinity model
        let models = {};

        if (filterStatusesArray.includes('scheduled')) {
            let scheduledInfinityModelParams = {...queryParams, order: params.order || 'published_at desc', filter: this._filterString({...filterParams, status: 'scheduled'})};
            models.scheduledInfinityModel = this.infinity.model(this.modelName, assign({perPage, startingPage: 1}, paginationParams, scheduledInfinityModelParams), PostsInfinityModel);
        }
        if (filterStatusesArray.includes('draft')) {
            let draftInfinityModelParams = {...queryParams, order: params.order || 'updated_at desc', filter: this._filterString({...filterParams, status: 'draft'})};
            models.draftInfinityModel = this.infinity.model(this.modelName, assign({perPage, startingPage: 1}, paginationParams, draftInfinityModelParams), PostsInfinityModel);
        }
        if (filterStatusesArray.includes('published') || filterStatusesArray.includes('sent')) {
            let publishedAndSentInfinityModelParams;
            if (filterStatusesArray.includes('published') && filterStatusesArray.includes('sent')) {
                publishedAndSentInfinityModelParams = {...queryParams, order: params.order || 'published_at desc', filter: this._filterString({...filterParams, status: '[published,sent]'})};
            } else {
                publishedAndSentInfinityModelParams = {...queryParams, order: params.order || 'published_at desc', filter: this._filterString({...filterParams, status: filterStatusesArray.includes('published') ? 'published' : 'sent'})};
            }
            models.publishedAndSentInfinityModel = this.infinity.model(this.modelName, assign({perPage, startingPage: 1}, paginationParams, publishedAndSentInfinityModelParams), PostsInfinityModel);
        }

        return RSVP.hash(models);
    }

    /**
     * 按 id 分批查询 posts,避免把大量 id 拼进单条 GET URL(超长会被 Nginx 414 拒绝)。
     * 每批最多 batchSize 个 id,拼回后按 matched id 的顺序(即展示顺序)排序,
     * 并补齐 submission / analytics 数据,等价于 infinity 的 afterInfinityModel。
     * @param {string[]} ids 匹配到的 post id(已按展示 order 排好)
     * @param {{filterParams: object, order: string, batchSize?: number}} opts
     * @returns {Promise<Array>} 已解析、已排序的 post 数组
     */
    async _fetchPostsByIdsBatched(ids, {filterParams, order, batchSize = 50}) {
        const batches = [];
        for (let i = 0; i < ids.length; i += batchSize) {
            batches.push(ids.slice(i, i + batchSize));
        }

        const results = await Promise.all(batches.map((batch) => {
            const filter = this._filterString({...filterParams, id: `[${batch.join(',')}]`});
            return this.store.query('post', {limit: 'all', order, filter});
        }));

        const orderIndex = new Map(ids.map((id, idx) => [id, idx]));
        const posts = [];
        results.forEach(result => result.forEach(post => posts.push(post)));
        // 各批之间的顺序会乱,统一按 matched id 顺序(= 展示顺序)重排
        posts.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

        // 补齐列表列所需数据(与 PostsInfinityModel.afterInfinityModel 一致)
        const promises = [];
        if (posts.length > 0) {
            promises.push(this.predictMixin.loadStaffPostSubmissions(posts.map(p => p.id)));

            const publishedPosts = posts.filter(p => ['published', 'sent'].includes(p.status));
            if (publishedPosts.length > 0) {
                if (this.settings.webAnalyticsEnabled) {
                    promises.push(this.postAnalytics.loadVisitorCounts(publishedPosts.map(p => p.uuid)));
                }
                if (this.settings.membersTrackSources) {
                    promises.push(this.postAnalytics.loadMemberCounts(publishedPosts));
                }
                promises.push(this.postAnalytics.loadReadCounts(publishedPosts));
            }
        }
        await Promise.all(promises);

        return posts;
    }

    // trigger a background load of all tags and authors for use in filter dropdowns
    setupController(controller, model) {
        super.setupController(...arguments);

        if (!this.session.user.isAuthorOrContributor && !controller._hasLoadedAuthors) {
            this.store.query('user', {limit: 'all'}).then(() => {
                controller._hasLoadedAuthors = true;
            });
        }

        if (controller.tag && !controller.selectedTag?.slug || controller.selectedTag?.slug === '!unknown') {
            this.store.queryRecord('tag', {slug: controller.tag});
        }

        if (controller.selectionList) {
            if (this.session.user.isAuthorOrContributor) {
                controller.selectionList.enabled = false;
            }
            controller.selectionList.infinityModel = model;
            controller.selectionList.clearSelection();
        }

        // Fetch analytics data for visible posts
        this._fetchAnalyticsForPosts(model);

        // Fetch predict mixin submissions for contributors
        if (this.session.user.isContributor || this.session.user.isAdmin) {
            this._fetchPredictMixinForPosts(model);
        }
    }

    /**
     * Fetch predict mixin data for all visible posts
     * @param {Object} model - The posts model containing infinity models
     */
    async _fetchPredictMixinForPosts(model) {
        const posts = [];
        if (model.scheduledInfinityModel?.content) {
            posts.push(...model.scheduledInfinityModel.content);
        }
        if (model.draftInfinityModel?.content) {
            posts.push(...model.draftInfinityModel.content);
        }
        if (model.publishedAndSentInfinityModel?.content) {
            posts.push(...model.publishedAndSentInfinityModel.content);
        }
        
        if (posts.length === 0) {
            return;
        }

        const postIds = posts.map(post => post.id);
        await this.predictMixin.loadStaffPostSubmissions(postIds);
    }

    /**
     * Fetch analytics data for all visible posts
     * @param {Object} model - The posts model containing infinity models
     */
    async _fetchAnalyticsForPosts(model) {
        // Early return if neither analytics feature is enabled
        if (!this.settings.webAnalyticsEnabled && !this.settings.membersTrackSources) {
            return;
        }

        const posts = [];
        if (model.publishedAndSentInfinityModel?.content) {
            posts.push(...model.publishedAndSentInfinityModel.content);
        }
        
        if (posts.length === 0) {
            return;
        }

        const promises = [];
        
        // Fetch visitor counts if web analytics is enabled
        if (this.settings.webAnalyticsEnabled) {
            const postUuids = posts.map(post => post.uuid);
            promises.push(this.postAnalytics.loadVisitorCounts(postUuids));
        }
        
        // Fetch member counts if member tracking is enabled
        if (this.settings.membersTrackSources) {
            promises.push(this.postAnalytics.loadMemberCounts(posts));
        }

        promises.push(this.postAnalytics.loadReadCounts(posts));

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    @action
    queryParamsDidChange() {
        // scroll back to the top
        let contentList = document.querySelector('.content-list');
        if (contentList) {
            contentList.scrollTop = 0;
        }

        super.actions.queryParamsDidChange.call(this, ...arguments);
    }

    buildRouteInfoMetadata() {
        return {
            titleToken: 'Posts'
        };
    }

    /**
     * Returns an object containing the status filter based on the given type.
     *
     * @param {string} type - The type of filter to generate (draft, published, scheduled, sent).
     * @returns {Object} - An object containing the status filter.
     */
    _getTypeFilters(type) {
        let status = '[draft,scheduled,published,sent]';

        switch (type) {
        case 'draft':
            status = 'draft';
            break;
        case 'published':
            status = 'published';
            break;
        case 'scheduled':
            status = 'scheduled';
            break;
        case 'sent':
            status = 'sent';
            break;
        }

        return {
            status: status === '[draft,scheduled,published,sent]' ? ['draft', 'published', 'scheduled', 'sent'] : status
        };
    }

    _filterString(filter) {
        return Object.keys(filter).map((key) => {
            let value = filter[key];

            if (!isBlank(value)) {
                return `${key}:${filter[key]}`;
            }

            return undefined;
        }).compact().join('+');
    }
}
