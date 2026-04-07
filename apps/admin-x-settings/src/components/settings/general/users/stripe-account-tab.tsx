import React, { useCallback } from "react";
import {
    SettingGroup,
    SettingGroupContent,
} from "@tryghost/admin-x-design-system";
import { Button } from "@tryghost/shade";

import stripeLogo from "../../../../assets/images/stripe.webp";
import logoutBoxRLine from "../../../../assets/images/logout-box-r-line.svg";
import { Icon } from "@tryghost/admin-x-design-system";
import Income from "./stripe-account/income";
import Withdrawal from "./stripe-account/withdrawal";
import useStripeAccount from "../../../../hooks/stripe/use-stripe-account";

const RightIcon = () => {
    return (
        <svg
            className="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="1251"
            width="20"
            height="20"
        >
            <path
                d="M689.984 469.312L461.12 240.448l60.352-60.352L853.376 512l-331.904 331.84-60.352-60.288 228.864-228.864H170.688V469.312h519.296z"
                fill="#000000"
                p-id="1252"
            ></path>
        </svg>
    );
};

const ArrowRightIcon = () => {
    return (
        <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="17696"
            width="20"
            height="20"
        >
            <path
                d="M561.984 512l-211.2-211.2 60.352-60.352L682.688 512l-271.552 271.552-60.352-60.352 211.2-211.2z"
                p-id="17697"
                fill="#ffffff"
            ></path>
        </svg>
    );
};

const StripeAccountTab: React.FC = () => {
    const {
        status,
        isPending,
        activeTab,
        page_size,
        currentPage,
        total,
        totalPages,
        statusText,
        connectUrl,
        isLoading,
        isFetching,
        staffWalletMe,
        staffList,
        cashLoading,
        ACCOUNT_STATUS,
        handleNextPage,
        handlePrevPage,
        handleTabChange,
        accountUnbind,
        handleWithDrawCash,
    } = useStripeAccount();

    const renderAction = useCallback(() => {
        const isQueryEnabled =
            status === ACCOUNT_STATUS.PENDING ||
            status === ACCOUNT_STATUS.COMPLETE;
        if (isQueryEnabled && (isLoading || isFetching)) return null;

        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                if (!connectUrl) return null;
                return (
                    <a
                        className="text-primary-600 hover:text-primary-500 cursor-pointer font-medium"
                        href={connectUrl}
                        rel="noopener noreferrer"
                    >
                        <ArrowRightIcon />
                    </a>
                );
            case ACCOUNT_STATUS.ACTIVE:
                return (
                    <img
                        src={logoutBoxRLine}
                        className="w-[16px] cursor-pointer"
                        onClick={accountUnbind}
                    />
                );
            case ACCOUNT_STATUS.COMPLETE:
                return (
                    <>
                        {connectUrl ? (
                            <a
                                className="text-primary-600 hover:text-primary-500 cursor-pointer font-medium"
                                href={connectUrl}
                                rel="noopener noreferrer"
                            >
                                <ArrowRightIcon />
                            </a>
                        ) : null}
                        <img
                            src={logoutBoxRLine}
                            className="w-[16px] cursor-pointer"
                            onClick={accountUnbind}
                        />
                    </>
                );
            default:
                return null;
        }
    }, [isLoading, connectUrl, status]);

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div
                    className={`bg-[#000000] h-[275px] w-full rounded-xl flex flex-col text-white p-[20px] md:p-[40px] relative justify-between`}
                >
                    <div className="flex flex-col gap-6 md:gap-12 relative z-[2]">
                        <div className="flex gap-4 font-medium text-lg">
                            <div>Stripe</div>
                            <div className="flex gap-2 items-center">
                                <span className="font-medium">
                                    {statusText}
                                </span>
                                {renderAction()}
                            </div>
                        </div>
                        {isPending ? (
                            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4 items-start md:grid-cols-3">
                                <div className="col-span-2 flex min-w-0 flex-col gap-2 md:col-span-1">
                                    <div className="text-[#9E9E9E] text-lg">
                                        Balance
                                    </div>
                                    <div className="truncate text-[22px] font-medium">
                                        {staffWalletMe?.available_amount || "0"}
                                    </div>
                                </div>
                                <div className="flex min-w-0 flex-col gap-2">
                                    <div className="text-[#9E9E9E]">
                                        Income
                                    </div>
                                    <div className="truncate text-[14px] md:text-[22px] font-medium">
                                        {staffWalletMe?.income_amount || "0"}
                                    </div>
                                </div>
                                <div className="flex min-w-0 flex-col gap-2">
                                    <div className="text-[#9E9E9E]">
                                        Withdrawn
                                    </div>
                                    <div className="truncate text-[14px] md:text-[22px] font-medium">
                                        {staffWalletMe?.withdrawal_amount || "0"}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div>
                        {isPending ? (
                            <Button
                                className="mt-2 dark:bg-gray-925/70 dark:hover:bg-gray-900 relative z-[20] text-[#000000]"
                                variant="secondary"
                                onClick={handleWithDrawCash}
                                disabled={(cashLoading || !(+staffWalletMe?.available_amount))}
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
                            <Income paginatedData={staffList} />
                        ) : (
                            <Withdrawal paginatedData={staffList} />
                        )}
                        <div className="mt-6 flex items-center justify-between text-sm text-grey-700">
                            <div>
                                Showing {(currentPage - 1) * page_size + 1}-
                                {Math.min(currentPage * page_size, total)} of{" "}
                                {total}
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
