import GlobalDataProvider from './global-data-provider';
import useSearchService, {type ComponentId, type SearchService} from '../../utils/search';
import {type ReactNode, createContext, useContext, useEffect, useState} from 'react';
import {ScrollSectionProvider} from '../../hooks/use-scroll-section';
import {type ZapierTemplate} from '../settings/advanced/integrations/zapier-modal';
import {isContributorUser} from '@tryghost/admin-x-framework/api/users';
import {officialThemes} from '../../data/official-themes';
import {useCurrentUser} from '@tryghost/admin-x-framework/api/current-user';
import {zapierTemplates} from '../../data/zapier-templates';

export type ThemeVariant = {
    category: string;
    previewUrl: string;
    image: string;
};

export type OfficialTheme = {
    name: string;
    category: string;
    previewUrl: string;
    ref: string;
    image: string;
    url?: string;
    variants?: ThemeVariant[]
};

export type Sorting = {
    type: string;
    option?: string;
    direction?: string;
}

export interface UpgradeStatusType {
    isRequired: boolean;
    message: string;
}

type AccountState = {
    view_state?: string;
};

type EmberBridgeState = {
    on: (eventName: 'accountStateChange', callback: (payload: {accountState: AccountState}) => void) => void;
    off: (eventName: 'accountStateChange', callback: (payload: {accountState: AccountState}) => void) => void;
    session?: {
        accountState?: AccountState;
    };
};

interface SettingsAppContextType {
    officialThemes: OfficialTheme[];
    zapierTemplates: ZapierTemplate[];
    search: SearchService;
    upgradeStatus?: UpgradeStatusType;
    accountState?: unknown;
    userRole?: string;
    isContributor?: boolean;
    sortingState?: Sorting[];
    setSortingState?: (sortingState: Sorting[]) => void;
    offersShowArchived: boolean;
    setOffersShowArchived: (show: boolean) => void;
}

const SettingsAppContext = createContext<SettingsAppContextType>({
    officialThemes,
    zapierTemplates,
    search: {
        filter: '',
        setFilter: () => {},
        checkVisible: () => true,
        highlightKeywords: () => '',
        noResult: false,
        setNoResult: () => {},
        registerComponent: () => {},
        unregisterComponent: () => {},
        getVisibleComponents: () => new Set<ComponentId>(),
        isOnlyVisibleComponent: () => false
    },
    sortingState: [],
    offersShowArchived: false,
    setOffersShowArchived: () => {}
});

type SettingsAppProviderProps = Partial<Omit<SettingsAppContextType, 'search'>> & {children: ReactNode};

const SettingsAppProvider: React.FC<SettingsAppProviderProps> = ({children, ...props}) => {
    const search = useSearchService();
    const {data: currentUser} = useCurrentUser();

    // a few sane defaults for keeping a sorting state
    const [sortingState, setSortingState] = useState<Sorting[]>([{
        type: 'offers',
        option: 'date-added',
        direction: 'desc'
    }]);

    const [offersShowArchived, setOffersShowArchived] = useState(false);

    // Sync accountState from Ember bridge
    const [accountState, setAccountState] = useState(() => {
        const bridge = (window as {EmberBridge?: {state?: EmberBridgeState}}).EmberBridge?.state;
        return props.accountState || bridge?.session?.accountState;
    });

    useEffect(() => {
        const bridge = (window as {EmberBridge?: {state?: EmberBridgeState}}).EmberBridge?.state;
        if (!bridge) {
            return;
        }

        // Ensure we have the latest state on mount in case it wasn't available during initial render
        if (bridge.session?.accountState) {
            setAccountState(bridge.session.accountState);
        }

        const handleAccountStateChange = (event: {accountState: AccountState}) => {
            setAccountState(event.accountState);
        };

        bridge.on('accountStateChange', handleAccountStateChange);

        return () => {
            bridge.off('accountStateChange', handleAccountStateChange);
        };
    }, []);

    const userRole = props.userRole ?? currentUser?.roles?.[0]?.name;
    const isContributor = props.isContributor ?? (currentUser ? isContributorUser(currentUser) : undefined);

    return (
        <SettingsAppContext.Provider value={{
            // Use local data as default, allow props to override (for backward compatibility)
            officialThemes,
            zapierTemplates,
            ...props,
            accountState,
            userRole,
            isContributor,
            search,
            sortingState,
            setSortingState,
            offersShowArchived,
            setOffersShowArchived
        }}>
            <GlobalDataProvider>
                <ScrollSectionProvider>
                    {children}
                </ScrollSectionProvider>
            </GlobalDataProvider>
        </SettingsAppContext.Provider>
    );
};

export default SettingsAppProvider;

export const useSettingsApp = () => useContext(SettingsAppContext);

export const useOfficialThemes = () => useSettingsApp().officialThemes;

export const useSearch = () => useSettingsApp().search;

export const useUpgradeStatus = () => useSettingsApp().upgradeStatus;
export const useAccountState = () => useSettingsApp().accountState;
export const useUserRole = () => useSettingsApp().userRole;
export const useIsContributor = () => useSettingsApp().isContributor;

export const useSortingState = () => {
    const {sortingState, setSortingState} = useSettingsApp();
    return {sortingState, setSortingState};
};

export const useOffersShowArchived = () => {
    const {offersShowArchived, setOffersShowArchived} = useSettingsApp();
    return {offersShowArchived, setOffersShowArchived};
};
