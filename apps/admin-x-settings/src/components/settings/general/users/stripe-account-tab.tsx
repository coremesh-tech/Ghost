import React, { useCallback } from "react";
import {
    SettingGroup,
    SettingGroupContent,
} from "@tryghost/admin-x-design-system";
// import { Button } from "@tryghost/shade";

import stripeLogo from "../../../../assets/images/stripe.webp";
// import logoutBoxRLine from "../../../../assets/images/logout-box-r-line.svg";
import { Icon } from "@tryghost/admin-x-design-system";
import Income from "./stripe-account/income";
import Withdrawal from "./stripe-account/withdrawal";
import useStripeAccount from "../../../../hooks/stripe/use-stripe-account";
import NiceModal from "@ebay/nice-modal-react";
import CountrySelectModal from "./stripe-account/country-select-modal";

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
        activeTab,
        page_size,
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
        handleLoginStripe,
    } = useStripeAccount();

    const openCountrySelect = useCallback(() => {
        NiceModal.show(CountrySelectModal, {
            onConfirm: (country: string) => {
                handleConnect(country);
            },
        });
    }, [handleConnect]);

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div
                    className={`bg-[#000000] h-[224px] w-full rounded-xl flex flex-col text-white p-[30px] md:p-[40px] relative justify-between`}
                >
                    <div className="flex flex-col gap-8 relative z-[2] justify-between">
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="text-[#9E9E9E]">Earnings</div>
                            <div className="truncate text-[22px] font-medium">
                                {staffWalletMe?.income_amount || "0"}
                            </div>
                        </div>
                        {(status === ACCOUNT_STATUS.PENDING || status === ACCOUNT_STATUS.COMPLETE) ? (
                            <div className="flex flex-col gap-2">
                                <div
                                    className="text-[#ffffff] flex flex-row items-center gap-4 cursor-pointer"
                                    onClick={
                                        connecting
                                            ? undefined
                                            : openCountrySelect
                                    }
                                >
                                    <div
                                        className={`font-medium text-[18px] ${
                                            connecting ? "opacity-50" : ""
                                        }`}
                                    >
                                        Connect With Stripe
                                    </div>
                                    <div
                                        className={`${
                                            connecting ? "opacity-50" : ""
                                        }`}
                                    >
                                        <ArrowRightIcon />
                                    </div>
                                </div>
                                <div className="text-[#9E9E9E] text-[12px] font-medium">
                                    To receive payouts, connect your Stripe
                                    account.
                                </div>
                            </div>
                        ) : status === ACCOUNT_STATUS.ACTIVE ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-row justify-between items-center">
                                    <div
                                        className="text-[#ffffff] flex flex-row items-center gap-4 cursor-pointer"
                                        onClick={
                                            loginLoading
                                                ? undefined
                                                : handleLoginStripe
                                        }
                                    >
                                        <div
                                            className={`font-medium text-[18px] ${
                                                loginLoading ? "opacity-50" : ""
                                            }`}
                                        >
                                            Goto Stripe
                                        </div>
                                        <div
                                            className={`mt-[2px] ${
                                                loginLoading ? "opacity-50" : ""
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
                                <div className="text-[#9E9E9E] text-[12px] font-medium">
                                    Goto your Stripe account to receive payouts.
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <img
                        src={stripeLogo}
                        className="w-[200px] h-[200px] absolute top-0 md:bottom-0 right-[10px]"
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
                    <div className="px-[12px] py-[16px] bg-[rgba(31,31,31,0.04)] rounded-[12px] flex flex-col gap-2 mt-[-20px]">
                        <div className="flex justify-between items-center font-medium">
                            <div>Stripe account connected!</div>
                            <div
                                className="cursor-pointer"
                                onClick={() => setShowNotice(false)}
                            >
                                <Icon name="close" size={8} className="[&>line]:stroke-[3.5px]" />
                            </div>
                        </div>
                        <div className="text-[rgba(0,0,0,0.6)] text-[12px]">
                            Your earnings will begin syncing to your Stripe account
                            shortly. Please allow up to 3–5 business days for your
                            current balance to appear. Future payouts will be
                            deposited automatically.<br /> If you have any questions,
                            please contact <span className="text-[#2A69FC]">help@mails.predictionmarkets.org</span>
                        </div>
                    </div>
                )}
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
            </SettingGroupContent>
        </SettingGroup>
    );
};

export default StripeAccountTab;
