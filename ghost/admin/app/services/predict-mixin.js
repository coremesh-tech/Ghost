import Service from '@ember/service';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

// 每批发送给 predict_mixin 的 ghost_post_id 数量上限。
// 无论一个视图下有多少 post,提交状态查询都按这个大小分批。
// 这是 POST 请求体(不受 URL 414 限制),取值主要影响外部服务单次处理量:
// 取 50 与 posts 的 GET 分批一致、单请求更轻、失败粒度更小;并发发出,请求数多几个无妨。
const SUBMISSION_BATCH_SIZE = 50;

function chunk(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
        batches.push(array.slice(i, i + size));
    }
    return batches;
}

export default class PredictMixinService extends Service {
    @service ajax;
    @service ghostPaths;
    @service session;

    @tracked submissions = {};
    _fetchedPostIds = new Set();

    // 单批请求:返回该批的 {ghost_post_id: submission} 映射;失败返回 {}
    async _requestSubmissionBatch(url, ghostPostIds) {
        try {
            const response = await this.ajax.request(url, {
                method: 'POST',
                data: JSON.stringify({ghost_post_ids: ghostPostIds}),
                contentType: 'application/json'
            });
            return response.predict_mixin && response.predict_mixin.length > 0 ? response.predict_mixin[0] : {};
        } catch (error) {
            return {};
        }
    }

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
        if (!ghostPostIds || ghostPostIds.length === 0) {
            return {};
        }
        const url = this._getApiEndpoint();

        // 无论多少 id,都按 SUBMISSION_BATCH_SIZE 分批并发请求,再合并结果。
        const batches = chunk(ghostPostIds, SUBMISSION_BATCH_SIZE);
        const partials = await Promise.all(batches.map(batch => this._requestSubmissionBatch(url, batch)));

        const result = Object.assign({}, ...partials);

        // Populate submissions cache with the newly fetched data
        this.submissions = {
            ...this.submissions,
            ...result
        };

        // Add these IDs to the fetched set so we don't fetch them again later
        Object.keys(result).forEach(id => this._fetchedPostIds.add(id));

        return result;
    }

    @task
    *_loadStaffPostSubmissions(ghostPostIds) {
        try {
            const url = this._getApiEndpoint();
            // 无论多少 id,都按 SUBMISSION_BATCH_SIZE 分批并发请求,再合并结果。
            const batches = chunk(ghostPostIds, SUBMISSION_BATCH_SIZE);
            const partials = yield Promise.all(batches.map(batch => this._requestSubmissionBatch(url, batch)));

            const result = Object.assign({}, ...partials);
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
