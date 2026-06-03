import SettingsAppProvider, {useAccountState, useIsContributor, useUserRole} from '@src/components/providers/settings-app-provider';
import assert from 'node:assert/strict';
import {type ReactNode} from 'react';
import {act, render, screen} from '@testing-library/react';

const mockUseCurrentUser = vi.fn();

vi.mock('@tryghost/admin-x-framework/api/current-user', () => ({
    useCurrentUser: mockUseCurrentUser
}));

vi.mock('@tryghost/admin-x-framework/api/users', () => ({
    isContributorUser: (user: {roles?: Array<{name?: string}>}) => {
        return Boolean(user.roles?.some(role => role.name === 'Contributor'));
    }
}));

vi.mock('@src/components/providers/global-data-provider', () => ({
    default: ({children}: {children: ReactNode}) => children
}));

type AccountState = {
    view_state: string;
};

type AccountStateChangeHandler = (event: {accountState: AccountState}) => void;

const createBridge = (accountState?: AccountState) => {
    const handlers = new Set<AccountStateChangeHandler>();

    return {
        session: {
            accountState
        },
        on: vi.fn((event: string, handler: AccountStateChangeHandler) => {
            if (event === 'accountStateChange') {
                handlers.add(handler);
            }
        }),
        off: vi.fn((event: string, handler: AccountStateChangeHandler) => {
            if (event === 'accountStateChange') {
                handlers.delete(handler);
            }
        }),
        emitAccountStateChange(nextAccountState: AccountState) {
            handlers.forEach((handler) => {
                handler({accountState: nextAccountState});
            });
        }
    };
};

const TestConsumer = () => {
    const accountState = useAccountState() as AccountState | undefined;
    const userRole = useUserRole();
    const isContributor = useIsContributor();

    return (
        <div>
            <span data-testid='account-state'>{accountState?.view_state ?? 'none'}</span>
            <span data-testid='user-role'>{userRole ?? 'none'}</span>
            <span data-testid='is-contributor'>{String(Boolean(isContributor))}</span>
        </div>
    );
};

describe('SettingsAppProvider', function () {
    beforeEach(function () {
        vi.clearAllMocks();
        // delete window.EmberBridge;
    });

    it('derives user role and contributor state from the current user query', function () {
        mockUseCurrentUser.mockReturnValue({
            data: {
                roles: [{name: 'Contributor'}]
            }
        });

        render(
            <SettingsAppProvider>
                <TestConsumer />
            </SettingsAppProvider>
        );

        assert.equal(screen.getByTestId('user-role').textContent, 'Contributor');
        assert.equal(screen.getByTestId('is-contributor').textContent, 'true');
    });

    it('keeps account state synced from the Ember bridge', function () {
        mockUseCurrentUser.mockReturnValue({
            data: {
                roles: [{name: 'Administrator'}]
            }
        });

        const bridge = createBridge({view_state: 'setup'});
        // window.EmberBridge = {state: bridge as never};

        render(
            <SettingsAppProvider>
                <TestConsumer />
            </SettingsAppProvider>
        );

        assert.equal(screen.getByTestId('account-state').textContent, 'setup');

        act(() => {
            bridge.emitAccountStateChange({view_state: 'ready'});
        });

        assert.equal(screen.getByTestId('account-state').textContent, 'ready');
    });
});
