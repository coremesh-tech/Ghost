import AdminXComponent from './admin-x-component';
import {inject as service} from '@ember/service';

export default class AdminXSettings extends AdminXComponent {
    @service upgradeStatus;
    static packageName = '@tryghost/admin-x-settings';

    additionalProps = () => ({
        upgradeStatus: this.upgradeStatus,
        accountState: this.session.accountState,
        userRole: this.session.user?.role?.name,
        isContributor: this.session.user?.role?.name === 'Contributor'
    });
}
