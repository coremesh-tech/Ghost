import React, {useCallback} from 'react';
import {
    SettingGroup,
    SettingGroupContent
} from '@tryghost/admin-x-design-system';
// import { Button } from "@tryghost/shade";

import stripeLogo from '../../../../assets/images/stripe.webp';
// import logoutBoxRLine from "../../../../assets/images/logout-box-r-line.svg";
import CountrySelectModal from './stripe-account/country-select-modal';
import Income from './stripe-account/income';
import NiceModal from '@ebay/nice-modal-react';
import Withdrawal from './stripe-account/withdrawal';
import useStripeAccount from '../../../../hooks/stripe/use-stripe-account';
import {Icon} from '@tryghost/admin-x-design-system';

// const RightIcon = () => {
//     return (
//         <svg
//             className="icon"
//             viewBox="0 0 1024 1024"
//             version="1.1"
//             xmlns="http://www.w3.org/2000/svg"
//             p-id="1251"
//             width="20"
//             height="20"
//         >
//             <path
//                 d="M689.984 469.312L461.12 240.448l60.352-60.352L853.376 512l-331.904 331.84-60.352-60.288 228.864-228.864H170.688V469.312h519.296z"
//                 fill="#000000"
//                 p-id="1252"
//             ></path>
//         </svg>
//     );
// };

const ArrowRightIcon = () => {
    return (
        <svg
            height="20"
            version="1.1"
            viewBox="0 0 1024 1024"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M561.984 512l-211.2-211.2 60.352-60.352L682.688 512l-271.552 271.552-60.352-60.352 211.2-211.2z"
                fill="#ffffff"
            ></path>
        </svg>
    );
};

const StripeAccountTab: React.FC = () => {
    const {
        status,
        activeTab,
        pageSize,
        currentPage,
        total,
        totalPages,
        handleConnect,
        connecting,
        staffWalletMe,
        staffList,
        // cashLoading,
        loginLoading,
        showNotice,
        ACCOUNT_STATUS,
        setShowNotice,
        handleNextPage,
        handlePrevPage,
        // handleTabChange,
        // accountUnbind,
        // handleWithDrawCash,
        handleLoginStripe
    } = useStripeAccount();

    const openCountrySelect = useCallback(() => {
        NiceModal.show(CountrySelectModal, {
            onConfirm: (country: string) => {
                handleConnect(country);
            }
        });
    }, [handleConnect]);

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div
                    className={`relative flex h-[224px] w-full flex-col justify-between rounded-xl bg-[#000000] p-[20px] text-white md:p-[30px]`}
                >
                    <div className="relative z-[2] flex flex-col justify-between gap-8">
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="text-[#9E9E9E]">Earnings</div>
                            <div className="truncate text-[22px] font-medium">
                                {staffWalletMe?.income_amount || '0'}
                            </div>
                        </div>
                        {(status === ACCOUNT_STATUS.PENDING) ? (
                            <div className="flex flex-col gap-2">
                                <div
                                    className="flex cursor-pointer flex-row items-center gap-4 text-[#ffffff]"
                                    onClick={
                                        connecting
                                            ? undefined
                                            : openCountrySelect
                                    }
                                >
                                    <div
                                        className={`text-[18px] font-medium ${
                                            connecting ? 'opacity-50' : ''
                                        }`}
                                    >
                                        Connect With Stripe
                                    </div>
                                    <div
                                        className={`${
                                            connecting ? 'opacity-50' : ''
                                        }`}
                                    >
                                        <ArrowRightIcon />
                                    </div>
                                </div>
                                <div className="text-[12px] font-medium text-[#9E9E9E]">
                                    To receive payouts, connect your Stripe
                                    account.(Supports Singapore only.)
                                </div>
                            </div>
                        ) : status === ACCOUNT_STATUS.ACTIVE ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-row items-center justify-between">
                                    <div
                                        className="flex cursor-pointer flex-row items-center gap-4 text-[#ffffff]"
                                        onClick={
                                            loginLoading
                                                ? undefined
                                                : handleLoginStripe
                                        }
                                    >
                                        <div
                                            className={`text-[18px] font-medium ${
                                                loginLoading ? 'opacity-50' : ''
                                            }`}
                                        >
                                            Goto Stripe
                                        </div>
                                        <div
                                            className={`mt-[2px] ${
                                                loginLoading ? 'opacity-50' : ''
                                            }`}
                                        >
                                            <ArrowRightIcon />
                                        </div>
                                    </div>
                                    {/* {status === ACCOUNT_STATUS.ACTIVE ? (
                                        <div
                                            className="flex flex-row justify-center items-center gap-4 cursor-pointer"
                                            onClick={accountUnbind}
                                        >
                                            <div className="text-[16px] font-medium">
                                                Unbind
                                            </div>
                                            <img
                                                src={logoutBoxRLine}
                                                className="w-[16px]"
                                            />
                                        </div>
                                    ) : null} */}
                                </div>
                                <div className="text-[12px] font-medium text-[#9E9E9E]">
                                    Goto your Stripe account to receive payouts.
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <img
                        className="absolute top-0 right-[10px] h-[200px] w-[200px] md:bottom-0"
                        src={stripeLogo}
                    />
                </div>
                {/* <div className="flex items-center gap-2">
                    <div
                        className={`font-medium text-lg px-4 py-2 rounded-4xl cursor-pointer ${
                            activeTab === "income"
                                ? "bg-[#1F1F1F] text-white"
                                : "bg-[rgba(31,31,31,0.12)]"
                        }`}
                        onClick={() => handleTabChange("income")}
                    >
                        Earnings
                    </div>
                </div> */}
                {(showNotice && status === ACCOUNT_STATUS.ACTIVE) && (
                    <div className="mt-[-20px] flex flex-col gap-2 rounded-[12px] bg-[rgba(31,31,31,0.04)] px-[16px] py-[16px]">
                        <div className="flex items-center justify-between font-medium">
                            <div>Stripe account connected!</div>
                            <div
                                className="cursor-pointer"
                                onClick={() => setShowNotice(false)}
                            >
                                <Icon className="[&>line]:stroke-[3.5px]" name="close" size={8} />
                            </div>
                        </div>
                        <div className="text-[12px] text-[rgba(0,0,0,0.6)]">
                            Your earnings will begin syncing to your Stripe account
                            shortly. Please allow up to 3–5 business days for your
                            current balance to appear. Future payouts will be
                            deposited automatically.<br /> If you have any questions,
                            please contact <span className="text-[#2A69FC]">help@mails.predictionmarkets.org</span>
                        </div>
                    </div>
                )}
                <div className="mt-[-20px]">
                    {activeTab === 'income' ? (
                        <Income paginatedData={staffList} />
                    ) : (
                        <Withdrawal paginatedData={staffList} />
                    )}
                    <div className="mt-6 flex items-center justify-between text-sm text-grey-700">
                        <div>
                            Showing {(currentPage - 1) * pageSize + 1}-
                            {Math.min(currentPage * pageSize, total)} of{' '}
                            {total}
                        </div>
                        <div className="flex gap-4">
                            <button
                                className={`p-1 ${
                                    currentPage === 1
                                        ? 'cursor-not-allowed text-black/30 dark:text-white/30'
                                        : 'cursor-pointer text-black hover:text-black/80 dark:text-white dark:hover:text-white/80'
                                }`}
                                disabled={currentPage === 1}
                                type="button"
                                onClick={handlePrevPage}
                            >
                                <Icon
                                    className="h-3 w-3 [&>path]:stroke-[3px]"
                                    name="chevron-left"
                                />
                            </button>
                            <span>
                                {currentPage} of {totalPages}
                            </span>
                            <button
                                className={`p-1 ${
                                    currentPage === totalPages
                                        ? 'cursor-not-allowed text-black/30 dark:text-white/30'
                                        : 'cursor-pointer text-black hover:text-black/80 dark:text-white dark:hover:text-white/80'
                                }`}
                                disabled={currentPage === totalPages}
                                type="button"
                                onClick={handleNextPage}
                            >
                                <Icon
                                    className="h-3 w-3 [&>path]:stroke-[3px]"
                                    name="chevron-right"
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </SettingGroupContent>
        </SettingGroup>
    );
};

export default StripeAccountTab;
