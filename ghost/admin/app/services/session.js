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
    handledOnboardingSuccess = false;

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
            const bindState = this.accountState?.view_state;
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

    shouldSyncAccountBinding() {
        if (this.handledOnboardingSuccess || typeof window === 'undefined') {
            return false;
        }

        const url = new URL(window.location.href);
        const searchValue = url.searchParams.get('onboarding');

        if (searchValue === 'success') {
            return true;
        }

        const [hashPath, hashQuery = ''] = url.hash.split('?');
        const hashParams = new URLSearchParams(hashQuery);

        if (!hashPath) {
            return false;
        }

        return hashParams.get('onboarding') === 'success';
    }

    clearOnboardingSuccessParam() {
        if (typeof window === 'undefined') {
            return;
        }

        const url = new URL(window.location.href);
        const [hashPath, hashQuery = ''] = url.hash.split('?');
        const hashParams = new URLSearchParams(hashQuery);

        url.searchParams.delete('onboarding');
        hashParams.delete('onboarding');

        const nextHashQuery = hashParams.toString();
        const nextHash = hashPath ? `${hashPath}${nextHashQuery ? `?${nextHashQuery}` : ''}` : '';

        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${nextHash}`);
    }

    normalizeAccountStateResponse(data) {
        if (data?.predict_mixin && Array.isArray(data.predict_mixin) && data.predict_mixin.length > 0) {
            return data.predict_mixin[0];
        }

        return data;
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
        
        // Ensure account state is fetched upon authentication (e.g. login)
        yield this.fetchAccountState();

        callback();
    }

    async fetchAccountState() {
        if (!this.user || this.user.role?.name !== 'Contributor') {
            return;
        }

        const shouldSyncAccountBinding = this.shouldSyncAccountBinding();

        try {
            const ghostPaths = this.configManager.get('ghostPaths');
            const endpoint = shouldSyncAccountBinding ? 'predict_mixin/account_bind_sync' : 'predict_mixin/account_state';
            const url = `${ghostPaths.url.api(endpoint)}`;
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin'
            });
            if (res.status === 401) {
                return;
            }
            if (res.ok) {
                const data = await res.json().catch(() => null);
                this.accountState = this.normalizeAccountStateResponse(data);
                if (shouldSyncAccountBinding) {
                    this.handledOnboardingSuccess = true;
                    this.clearOnboardingSuccessParam();
                }
                this.stateBridge.triggerAccountStateChange(this.accountState);
                const bindState = this.accountState?.view_state;
                if (bindState === 'ACTIVE') {
                    return;
                }
                this.notifications.showToast('Stripe account not connected', {type: 'warn', key: 'stripe.account-unbound'});
                }
        } catch (e) {
            console.error("Error fetching account state", e);
        }
    }

    @task({restartable: true})
    *pollAccountStateTask() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            yield timeout(600000); // 10 minutes
            if (!this.user || this.user.role?.name !== 'Contributor') {
                return;
            }
            yield this.fetchAccountState();
        }
    }
}
