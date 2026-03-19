import React, { useCallback, useEffect, useState } from "react";
import {
    SettingGroup,
    SettingGroupContent,
} from "@tryghost/admin-x-design-system";
import { useQuery } from "@tanstack/react-query";
import { useAccountState } from "../../../providers/settings-app-provider";
import { Button } from "@tryghost/shade";
import stripeLogo from "../../../../assets/images/stripe.webp";
import logoutBoxRLine from "../../../../assets/images/logout-box-r-line.svg";
import { Icon } from "@tryghost/admin-x-design-system";
import Income from "./stripe-account/income";
import Withdrawal from "./stripe-account/withdrawal";

const ACCOUNT_STATUS = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    INCOMPLETE: "INCOMPLETE",
    DISABLED: "DISABLED",
};

const MOCK_STRIPE_DATA = () => {
    return Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
        amount: `$${(Math.random() * 1000).toFixed(2)}`,
        status: i % 3 === 0 ? "pending" : "succeeded",
    }));
};

const RightIcon = () => {
    return (
        <svg
            className="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="1251"
            width="16"
            height="16"
        >
            <path
                d="M689.984 469.312L461.12 240.448l60.352-60.352L853.376 512l-331.904 331.84-60.352-60.288 228.864-228.864H170.688V469.312h519.296z"
                fill="#000000"
                p-id="1252"
            ></path>
        </svg>
    );
};

const StripeAccountTab: React.FC = () => {
    const accountState: any = useAccountState();
    const status = accountState?.[0]?.bind_state;
    const [activeTab, setActiveTab] = useState("income");
    const [currentPage, setCurrentPage] = useState(1);
    const [stripeData, setStripeData] = useState<any>([]);
    const itemsPerPage = 5;

    const totalPages = Math.ceil(stripeData.length / itemsPerPage);
    const paginatedData = stripeData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const isPending = !status || !(status === ACCOUNT_STATUS.PENDING);

    useEffect(() => {
        setStripeData(MOCK_STRIPE_DATA());
    }, []);

    const {
        data: connectUrl,
        isLoading,
        isFetching,
    } = useQuery({
        queryKey: ["stripeConnectUrl"],
        queryFn: async () => {
            const response = await fetch(
                "/ghost/api/admin/predict_mixin/connect_url/",
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (!response.ok) {
                throw new Error("Failed to get Stripe Connect URL");
            }
            const data = await response.json();
            if (
                data &&
                data.predict_mixin &&
                Array.isArray(data.predict_mixin) &&
                data.predict_mixin.length > 0
            ) {
                return data.predict_mixin[0][0].accountUrl;
            }
            return data.predict_mixin[0][0].accountUrl;
        },
        enabled:
            status === ACCOUNT_STATUS.PENDING ||
            status === ACCOUNT_STATUS.INCOMPLETE,
    });

    const statusText = (() => {
        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                return "Pending";
            case ACCOUNT_STATUS.ACTIVE:
                return "Active";
            case ACCOUNT_STATUS.INCOMPLETE:
                return "Incomplete";
            case ACCOUNT_STATUS.DISABLED:
                return "Disabled";
            default:
                return "Unknown";
        }
    })();

    const renderAction = useCallback(() => {
        const isQueryEnabled =
            status === ACCOUNT_STATUS.PENDING ||
            status === ACCOUNT_STATUS.INCOMPLETE;
        if (isQueryEnabled && (isLoading || isFetching)) return null;

        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                if (!connectUrl) return null;
                return (
                    <a
                        className="text-primary-600 hover:text-primary-500 cursor-pointer font-medium"
                        href={connectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <RightIcon />
                    </a>
                );
            case ACCOUNT_STATUS.ACTIVE:
                return (
                    <img
                        src={logoutBoxRLine}
                        className="w-[16px] cursor-pointer"
                    />
                );
            case ACCOUNT_STATUS.INCOMPLETE:
                if (!connectUrl) return null;
                return (
                    <a
                        className="hover:text-primary-500 cursor-pointer font-medium"
                        href={connectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <RightIcon />
                    </a>
                );
            default:
                return null;
        }
    }, [isLoading, connectUrl, status]);

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setStripeData(MOCK_STRIPE_DATA());
    };

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div
                    className={`bg-[#000000] h-[290px] md:h-[200px] w-full rounded-xl flex flex-col md:flex-row md:items-end justify-between text-white p-[20px] md:p-[40px] relative`}
                >
                    <div className="flex flex-col gap-16 md:gap-6 relative z-[2]">
                        <div className="flex gap-4 font-medium text-lg">
                            <div>Stripe</div>
                            <div className="flex gap-2">
                                <span className="font-medium">
                                    {statusText}
                                </span>
                                {renderAction()}
                            </div>
                        </div>
                        {isPending ? (
                            <div className="flex flex-col gap-2">
                                <div className="text-[#9E9E9E] font-medium text-lg">
                                    Balance
                                </div>
                                <div className="text-[24px]">$100,000.00</div>
                            </div>
                        ) : null}
                    </div>
                    <div>
                        {isPending ? (
                            <Button
                                className="mt-2 dark:bg-gray-925/70 dark:hover:bg-gray-900 relative z-[20] text-[#000000]"
                                variant="secondary"
                            >
                                Withdraw Cash
                                <RightIcon />
                            </Button>
                        ) : null}
                        <img
                            src={stripeLogo}
                            className="w-[200px] h-[200px] absolute top-0 md:bottom-0 right-[10px]"
                        />
                    </div>
                </div>
                {isPending ? (
                    <div className="flex items-center gap-2">
                        <div
                            className={`font-medium text-lg px-4 py-2 rounded-4xl cursor-pointer ${
                                activeTab === "income"
                                    ? "bg-[#1F1F1F] text-white"
                                    : "bg-[rgba(31,31,31,0.12)]"
                            }`}
                            onClick={() => handleTabChange("income")}
                        >
                            Income
                        </div>
                        <div
                            className={`font-medium text-lg px-4 py-2 rounded-4xl cursor-pointer ${
                                activeTab === "withdrawal"
                                    ? "bg-[#1F1F1F] text-white"
                                    : "bg-[rgba(31,31,31,0.12)]"
                            }`}
                            onClick={() => handleTabChange("withdrawal")}
                        >
                            Withdrawal
                        </div>
                    </div>
                ) : null}
                {isPending ? (
                    <div className="mt-[-20px]">
                        {activeTab === "income" ? (
                            <Income paginatedData={paginatedData} />
                        ) : (
                            <Withdrawal paginatedData={paginatedData} />
                        )}
                        <div className="mt-6 flex items-center justify-between text-sm text-grey-700">
                            <div>
                                Showing {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(
                                    currentPage * itemsPerPage,
                                    stripeData.length
                                )}{" "}
                                of {stripeData.length}
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                    className={`p-1 ${
                                        currentPage === 1
                                            ? "text-black/30 dark:text-white/30 cursor-not-allowed"
                                            : "text-black dark:text-white hover:text-black/80 dark:hover:text-white/80 cursor-pointer"
                                    }`}
                                >
                                    <Icon
                                        name="chevron-left"
                                        className="w-3 h-3 [&>path]:stroke-[3px]"
                                    />
                                </button>
                                <span>
                                    {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className={`p-1 ${
                                        currentPage === totalPages
                                            ? "text-black/30 dark:text-white/30 cursor-not-allowed"
                                            : "text-black dark:text-white hover:text-black/80 dark:hover:text-white/80 cursor-pointer"
                                    }`}
                                >
                                    <Icon
                                        name="chevron-right"
                                        className="w-3 h-3 [&>path]:stroke-[3px]"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </SettingGroupContent>
        </SettingGroup>
    );
};

export default StripeAccountTab;
