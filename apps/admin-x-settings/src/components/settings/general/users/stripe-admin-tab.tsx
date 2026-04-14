import React from "react";
import {
    SettingGroup,
    SettingGroupContent,
    TextField,
    Icon
} from "@tryghost/admin-x-design-system";
import Settlement from "./stripe-admin/settlement";
import Withdraw from "./stripe-admin/withdraw";
import useStripeAdmin from "../../../../hooks/stripe/use-stripe-admin";

const StripeAdminTab: React.FC = () => {
    const {
        activeTab,
        page_size,
        currentPage,
        total,
        totalPages,
        staffList,
        periodMonth,
        dateRef,
        handleNextPage,
        handlePrevPage,
        handleTabChange,
        handleImplement,
        handleDateChange,
        handleCheckDetail,
    } = useStripeAdmin();

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={`font-medium text-lg rounded-4xl`}
                            onClick={() => handleTabChange("settlement")}
                        >
                            Settlement
                        </div>
                        {/* <div
                            className={`font-medium text-lg px-4 py-2 rounded-4xl cursor-pointer ${
                                activeTab === "withdraw"
                                    ? "bg-[#1F1F1F] text-white"
                                    : "bg-[rgba(31,31,31,0.12)]"
                            }`}
                            onClick={() => handleTabChange("withdraw")}
                        >
                            Withdraw
                        </div> */}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-40">
                            <TextField
                                inputRef={dateRef}
                                type="month"
                                id="birthday"
                                name="birthday"
                                onChange={handleDateChange}
                                value={periodMonth}
                                className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-[-20px]">
                    {activeTab === "settlement" ? (
                        <Settlement
                            paginatedData={staffList}
                            handleImplement={handleImplement}
                            handleCheckDetail={handleCheckDetail}
                        />
                    ) : (
                        <Withdraw paginatedData={staffList} />
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

export default StripeAdminTab;
