import Component from '@glimmer/component';
import RejectSubmissionModal from '../modals/reject-submission';
import {action} from '@ember/object';
import {formatPostTime} from 'ghost-admin/helpers/gh-format-post-time';
import {inject} from 'ghost-admin/decorators/inject';
import {inject as service} from '@ember/service';
import {tracked} from '@glimmer/tracking';

export default class PostsListItemClicks extends Component {
    @service feature;
    @service session;
    @service settings;
    @service postAnalytics;
    @service predictMixin;
    @service ajax;
    @service ghostPaths;
    @service router;
    @service modals;

    @tracked isHovered = false;

    @inject config;

    get post() {
        return this.args.post;
    }

    get errorClass() {
        if (this.post.didEmailFail) {
            return 'error';
        }
        return '';
    }

    get scheduledText() {
        let text = [];

        let formattedTime = formatPostTime(
            this.post.publishedAtUTC,
            {timezone: this.settings.timezone, scheduled: true}
        );
        text.push(formattedTime);

        return text.join(' ');
    }

    get visitorCount() {
        return this.postAnalytics.getVisitorCount(this.post.uuid);
    }

    get hasVisitorData() {
        return this.visitorCount !== null;
    }

    get memberCounts() {
        return this.postAnalytics.getMemberCounts(this.post.uuid);
    }

    get hasMemberData() {
        return this.memberCounts !== null;
    }

    get totalMemberConversions() {
        if (!this.memberCounts) {
            return 0;
        }
        return this.memberCounts.free + this.memberCounts.paid;
    }

    get predictSubmission() {
        if (!this.session.user.isContributor && !this.session.user.isAdmin) {
            return null;
        }
        return this.predictMixin.getSubmission(this.post.id);
    }

    get predictStatusColor() {
        const submission = this.predictSubmission;
        if (!submission || !submission.submission_status) {
            return '';
        }
        
        switch (submission.submission_status) {
        case 'IDLE':
            return 'color: #738a94;';
        case 'CHECK':
            return 'color: #f08a5d;';
        case 'PASSED':
            return 'color: #30cf43;';
        default:
            return 'color: #738a94;';
        }
    }

    get predictStatusText() {
        const submission = this.predictSubmission;
        if (!submission || !submission.submission_status) {
            return '';
        }
        
        switch (submission.submission_status) {
        case 'IDLE':
            return 'Idle';
        case 'CHECK':
            return 'Checking';
        case 'PASSED':
            return 'Passed';
        default:
            return '';
        }
    }

    @action
    mouseOver() {
        this.isHovered = true;
    }

    @action
    mouseLeave() {
        this.isHovered = false;
    }

    @action
    async approveSubmission(post) {
        try {
            const url = this.ghostPaths.url.api('predict_mixin/admin_approve');
            const res = await this.ajax.request(url, {
                method: 'POST',
                data: {ghost_post_id: post.id}
            });
            if (!res.predict_mixin?.[0]?.ghost_post_id) {
                this.notifications.error('Failed to approve submission');   
                return;
            }
            post.set('status', 'published');
            await post.save();
            this.router.transitionTo(this.router.currentRouteName, {
                queryParams: {refresh: new Date().getTime()}
            });
        } catch (error) {
            this.notifications.error('Failed to approve submission');   
        }
    }

    @action
    async rejectSubmission(post) {
        try {
            const reviewComment = await this.modals.open(RejectSubmissionModal);
            if (!reviewComment || typeof reviewComment !== 'string') {
                return;
            }

            const url = this.ghostPaths.url.api('predict_mixin/admin_reject');
            const res = await this.ajax.request(url, {
                method: 'POST',
                data: {
                    ghost_post_id: post.id,
                    review_comment: reviewComment
                }
            });
            if (!res.predict_mixin?.[0]?.ghost_post_id) {
                this.notifications.error('Failed to reject submission');   
                return;
            }
            this.router.transitionTo(this.router.currentRouteName, {
                queryParams: {refresh: new Date().getTime()}
            });
        } catch (error) {
            this.notifications.error('Failed to reject submission');   
        }
    }

    @action
    async withdrawSubmission(post) {
        try {
            const url = this.ghostPaths.url.api('predict_mixin/staff_withdraw');
            const res = await this.ajax.request(url, {
                method: 'POST',
                data: {ghost_post_id: post.id}
            });
            if (!res.predict_mixin?.[0]?.ghost_post_id) {
                this.notifications.error('Failed to withdraw submission');   
                return;
            }
            this.router.transitionTo(this.router.currentRouteName, {
                queryParams: {refresh: new Date().getTime()}
            });
        } catch (error) {
            this.notifications.error('Failed to withdraw submission');   
        }
    }
}
