import ESASessionService from 'ember-simple-auth/services/session';
import RSVP from 'rsvp';
import {configureScope} from '@sentry/ember';
import {getOwner} from '@ember/application';
import {inject} from 'ghost-admin/decorators/inject';
import {run} from '@ember/runloop';
import {inject as service} from '@ember/service';
import {task, timeout} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

export default class SessionService extends ESASessionService {
    @service configManager;
    @service('store') dataStore;
    @service feature;
    @service koenig;
    @service notifications;
    @service router;
    @service frontend;
    @service settings;
    @service ui;
    @service upgradeStatus;
    @service membersUtils;
    @service stateBridge;
    @service themeManagement;

    @inject config;

    @tracked user = null;
    @tracked accountState = null;

    skipAuthSuccessHandler = false;

    async populateUser(options = {}) {
        if (this.user) {
            return;
        }

        const id = options.id || 'me';
        const user = await this.dataStore.queryRecord('user', {id});
        this.user = user;
    }

    async postAuthPreparation() {
        await RSVP.all([
            this.configManager.fetchAuthenticated(),
            this.feature.fetch(),
            this.settings.fetch(),
            this.membersUtils.fetch()
        ]);

        // Theme management requires features to be loaded
        this.themeManagement.fetch().catch(console.error); // eslint-disable-line no-console

        await this.frontend.loginIfNeeded();

        // update Sentry with the full Ghost version which we only get after authentication
        if (this.config.sentry_dsn) {
            configureScope((scope) => {
                scope.addEventProcessor((event) => {
                    return new Promise((resolve) => {
                        resolve({
                            ...event,
                            release: `ghost@${this.config.version}`,
                            user: {
                                role: this.user.role.name
                            }
                        });
                    });
                });
            });
        }

        this.loadServerNotifications();

        // pre-emptively load editor code in the background to avoid loading state when opening editor
        this.koenig.fetch();

        await this.fetchAccountState();

        if (this.user?.role?.name === 'Contributor') {
            const bindState = this.accountState?.[0]?.bind_state;
            if (bindState !== 'ACTIVE') {
                if (!this.pollAccountStateTask.isRunning) {
                    this.pollAccountStateTask.perform();
                }
            }
        }
    }

    async handleAuthentication() {
        if (this.handleAuthenticationTask.isRunning) {
            return this.handleAuthenticationTask.last;
        }

        return this.handleAuthenticationTask.perform(() => {
            this.stateBridge.triggerEmberAuthChange();

            if (this.skipAuthSuccessHandler) {
                this.skipAuthSuccessHandler = false;
                return;
            }

            super.handleAuthentication('home');
        });
    }

    /**
     * Always try to re-setup session & retry the original transition
     * if user data is still available in session store although the
     * ember-session is unauthenticated.
     *
     * If success, it will retry the original transition.
     * If failed, it will be handled by the redirect to sign in.
     */
    async requireAuthentication(transition, route) {
        // Only when ember session invalidated
        if (!this.isAuthenticated) {
            transition.abort();

            if (this.user) {
                await this.setup();
                this.notifications.clearAll();
                transition.retry();
            }
        }

        super.requireAuthentication(transition, route);
    }

    handleInvalidation() {
        let transition = this.appLoadTransition;

        if (transition) {
            transition.send('authorizationFailed');
        } else {
            run.scheduleOnce('routerTransitions', this, 'triggerAuthorizationFailed');
        }
    }

    // TODO: this feels hacky, find a better way than using .send
    triggerAuthorizationFailed() {
        getOwner(this).lookup(`route:${this.router.currentRouteName}`)?.send('authorizationFailed');
    }

    loadServerNotifications() {
        if (this.isAuthenticated) {
            if (!this.user.isAuthorOrContributor) {
                this.dataStore.findAll('notification', {reload: true}).then((serverNotifications) => {
                    serverNotifications.forEach((notification) => {
                        if (notification.top || notification.custom) {
                            this.notifications.handleNotification(notification);
                        } else {
                            this.upgradeStatus.handleUpgradeNotification(notification);
                        }
                    });
                });
            }
        }
    }

    @task({drop: true})
    *handleAuthenticationTask(callback) {
        if (!this.user) {
            try {
                yield this.populateUser();
            } catch (err) {
                yield this.invalidate();
            }
        }

        callback();
    }

    async fetchAccountState() {
        if (!this.user || this.user.role?.name !== 'Contributor') {
            return;
        }
        try {
            const ghostPaths = this.configManager.get('ghostPaths');
            const url = `${ghostPaths.url.api('predict_mixin/account_state')}`;
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin'
            });
            if (res.status === 401) {
                return;
            }
            if (res.ok) {
                const data = await res.json().catch(() => null);
                // The API framework wraps the response in an object with a key matching the docName
                // e.g., { predict_mixin: [ { ...actualData } ] }
                if (data && data.predict_mixin && Array.isArray(data.predict_mixin) && data.predict_mixin.length > 0) {
                    this.accountState = data.predict_mixin[0];
                } else {
                    this.accountState = data;
                }
                this.stateBridge.triggerAccountStateChange(this.accountState);
            }
        } catch (e) {
            console.error("Error fetching account state", e);
        }
    }

    @task({restartable: true})
    *pollAccountStateTask() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            yield timeout(3600000);
            if (!this.user || this.user.role?.name !== 'Contributor') {
                return;
            }
            yield this.fetchAccountState();
            const bindState = this.accountState?.[0]?.bind_state;
            if (bindState === 'ACTIVE') {
                return;
            }
            this.notifications.showToast('Stripe account not connected', {type: 'warn', key: 'stripe.account-unbound'});
        }
    }
}
