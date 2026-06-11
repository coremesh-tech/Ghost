import Component from '@glimmer/component';
import {action} from '@ember/object';
import {tracked} from '@glimmer/tracking';

export default class RejectSubmissionModal extends Component {
    @tracked reviewComment = '';

    get confirmDisabled() {
        return !this.reviewComment.trim();
    }

    @action
    updateReviewComment(event) {
        this.reviewComment = event.target.value;
    }

    @action
    confirm() {
        if (this.confirmDisabled) {
            return;
        }
        // Pass the comment back to the caller
        this.args.close(this.reviewComment);
    }
}
