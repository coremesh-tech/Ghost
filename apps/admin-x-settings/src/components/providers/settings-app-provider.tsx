import GlobalDataProvider from './global-data-provider';
import useSearchService, {type ComponentId, type SearchService} from '../../utils/search';
import {type ReactNode, createContext, useContext, useEffect, useState} from 'react';
import {ScrollSectionProvider} from '../../hooks/use-scroll-section';
import {type ZapierTemplate} from '../settings/advanced/integrations/zapier-modal';
import {officialThemes} from '../../data/official-themes';
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

type BridgeSessionState = {
    accountState?: unknown;
    upgradeStatus?: UpgradeStatusType;
    userRole?: string;
    isContributor?: boolean;
};

const getBridgeSessionState = (): BridgeSessionState => {
    const bridge = (window as any).EmberBridge?.state;
    const userRole = bridge?.session?.user?.role?.name;

    return {
        accountState: bridge?.session?.accountState,
        upgradeStatus: bridge?.session?.upgradeStatus,
        userRole,
        isContributor: userRole === 'Contributor'
    };
};

const SettingsAppProvider: React.FC<SettingsAppProviderProps> = ({children, ...props}) => {
    const search = useSearchService();

    // a few sane defaults for keeping a sorting state
    const [sortingState, setSortingState] = useState<Sorting[]>([{
        type: 'offers',
        option: 'date-added',
        direction: 'desc'
    }]);

    const [offersShowArchived, setOffersShowArchived] = useState(false);

    // Sync accountState from Ember bridge
    const [accountState, setAccountState] = useState(() => {
        return props.accountState || getBridgeSessionState().accountState;
    });
    const [upgradeStatus, setUpgradeStatus] = useState(() => {
        return props.upgradeStatus || getBridgeSessionState().upgradeStatus;
    });
    const [userRole, setUserRole] = useState(() => {
        return props.userRole || getBridgeSessionState().userRole;
    });
    const [isContributor, setIsContributor] = useState(() => {
        return props.isContributor ?? getBridgeSessionState().isContributor;
    });

    useEffect(() => {
        const bridge = (window as any).EmberBridge?.state;
        if (!bridge) {
            return;
        }

        const syncSessionState = () => {
            const bridgeSessionState = getBridgeSessionState();

            if (bridgeSessionState.accountState) {
                setAccountState(bridgeSessionState.accountState);
            }

            if (bridgeSessionState.upgradeStatus) {
                setUpgradeStatus(bridgeSessionState.upgradeStatus);
            }

            if (bridgeSessionState.userRole) {
                setUserRole(bridgeSessionState.userRole);
            }

            if (typeof bridgeSessionState.isContributor === 'boolean') {
                setIsContributor(bridgeSessionState.isContributor);
            }
        };

        syncSessionState();

        const handleAccountStateChange = (event: any) => {
            setAccountState(event.accountState);
        };
        const handleAuthChange = () => {
            syncSessionState();
        };

        bridge.on('accountStateChange', handleAccountStateChange);
        bridge.on('emberAuthChange', handleAuthChange);

        return () => {
            bridge.off('accountStateChange', handleAccountStateChange);
            bridge.off('emberAuthChange', handleAuthChange);
        };
    }, []);

    return (
        <SettingsAppContext.Provider value={{
            // Use local data as default, allow props to override (for backward compatibility)
            officialThemes,
            zapierTemplates,
            ...props,
            accountState,
            upgradeStatus,
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
