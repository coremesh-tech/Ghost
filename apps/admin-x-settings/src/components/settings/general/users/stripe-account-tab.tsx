import React, { useCallback } from "react";
import {
    SettingGroup,
    SettingGroupContent,
} from "@tryghost/admin-x-design-system";
import { useQuery } from "@tanstack/react-query";
import { useAccountState } from "../../../providers/settings-app-provider";

const ACCOUNT_STATUS = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    INCOMPLETE: "INCOMPLETE",
    DISABLED: "DISABLED",
};

const StripeAccountTab: React.FC = () => {
    const accountState: any = useAccountState();
    const status = accountState?.[0]?.bind_state;

    const {data: connectUrl, isLoading} = useQuery({
        queryKey: ['stripeConnectUrl'],
        queryFn: async () => {
            const response = await fetch('/ghost/api/admin/predict_mixin/connect_url/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to get Stripe Connect URL');
            }
            const data = await response.json();
            if (data && data.predict_mixin && Array.isArray(data.predict_mixin) && data.predict_mixin.length > 0) {
                return data.predict_mixin[0][0].accountUrl;
            }
            return data.predict_mixin[0][0].accountUrl;
        },
        enabled: status === ACCOUNT_STATUS.PENDING || status === ACCOUNT_STATUS.INCOMPLETE
    });

    const statusText = (() => {
        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                return "To Be Bound";
            case ACCOUNT_STATUS.ACTIVE:
                return "Connected";
            case ACCOUNT_STATUS.INCOMPLETE:
                return "Incomplete";
            case ACCOUNT_STATUS.DISABLED:
                return "Disabled";
            default:
                return "Unknown";
        }
    })();

    const renderAction = useCallback(() => {
        if (isLoading && !connectUrl) return null;
        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                return (
                    <a
                        className="text-primary-600 hover:text-primary-500 cursor-pointer font-medium"
                        href={connectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Go binding
                    </a>
                );
            case ACCOUNT_STATUS.INCOMPLETE:
                return (
                    <a
                        className="text-primary-600 hover:text-primary-500 cursor-pointer font-medium"
                        href={connectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        To improve
                    </a>
                );
            default:
                return null;
        }
    }, [isLoading, connectUrl, status]);

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="font-medium">Stripe account status</div>
                        <div className="text-grey-700 text-xs mt-1">
                            Shows whether you are connected to a Stripe account
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-medium">{statusText}</span>
                        {renderAction()}
                    </div>
                </div>
            </SettingGroupContent>
        </SettingGroup>
    );
};

export default StripeAccountTab;
