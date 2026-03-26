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
            let preFilterParams = {...filterParams};
            preFilterParams.limit = 'all';
            preFilterParams.fields = 'id';
            
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
                    filterParams.id = `[${postIds.join(',')}]`;
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
