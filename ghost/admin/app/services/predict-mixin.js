import Service from '@ember/service';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

export default class PredictMixinService extends Service {
    @service ajax;
    @service ghostPaths;
    @service session;

    @tracked submissions = {};
    _fetchedPostIds = new Set();

    loadStaffPostSubmissions(postIds) {
        if (!postIds || postIds.length === 0) {
            return Promise.resolve();
        }

        const newPostIds = postIds.filter(id => !this._fetchedPostIds.has(id));

        if (newPostIds.length === 0) {
            return Promise.resolve();
        }

        newPostIds.forEach(id => this._fetchedPostIds.add(id));

        return this._loadStaffPostSubmissions.perform(newPostIds);
    }

    getSubmission(postId) {
        return this.submissions && this.submissions[postId] ? this.submissions[postId] : null;
    }

    reset() {
        this.submissions = {};
        this._fetchedPostIds.clear();
    }

    _getApiEndpoint() {
        if (this.session.user.isAdmin) {
            return this.ghostPaths.url.api('predict_mixin/admin_post_submissions');
        } else if (this.session.user.isContributor) {
            return this.ghostPaths.url.api('predict_mixin/post_submissions');
        }
    }

    async fetchPostSubmissionsByStatus(ghostPostIds) {
        try {
            const url = this._getApiEndpoint();
            const response = await this.ajax.request(url, {
                method: 'POST',
                data: JSON.stringify({ghost_post_ids: ghostPostIds}),
                contentType: 'application/json'
            });

            const result = response.predict_mixin && response.predict_mixin.length > 0 ? response.predict_mixin[0] : {};
            // eslint-disable-next-line no-console
            // Populate submissions cache with the newly fetched data
            this.submissions = {
                ...this.submissions,
                ...result
            };

            // Add these IDs to the fetched set so we don't fetch them again later
            Object.keys(result).forEach(id => this._fetchedPostIds.add(id));

            return result;
        } catch (error) {
            // Error handling
            return {};
        }
    }

    @task
    *_loadStaffPostSubmissions(ghostPostIds) {
        try {
            const url = this._getApiEndpoint();
            const response = yield this.ajax.request(url, {
                method: 'POST',
                data: JSON.stringify({ghost_post_ids: ghostPostIds}),
                contentType: 'application/json'
            });
            
            const result = response.predict_mixin && response.predict_mixin.length > 0 ? response.predict_mixin[0] : {};
            // eslint-disable-next-line no-console
            // Assume result is a map of ghost_post_id to object
            this.submissions = {
                ...this.submissions,
                ...result
            };
        } catch (error) {
            ghostPostIds.forEach(id => this._fetchedPostIds.delete(id));
        }
    }
}
