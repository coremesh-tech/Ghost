import React from 'react';
import Settlement from './stripe-admin/settlement';
import Withdraw from './stripe-admin/withdraw';
import useStripeAdmin from '../../../../hooks/stripe/use-stripe-admin';
import {
    Icon,
    SettingGroup,
    SettingGroupContent,
    TextField
} from '@tryghost/admin-x-design-system';

const StripeAdminTab: React.FC = () => {
    const {
        activeTab,
        pageSize,
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
        handleCheckDetail
    } = useStripeAdmin();

    return (
        <SettingGroup border={false}>
            <SettingGroupContent>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={`rounded-4xl text-lg font-medium`}
                            onClick={() => handleTabChange('settlement')}
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
                                className="cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                                id="birthday"
                                inputRef={dateRef}
                                name="birthday"
                                type="month"
                                value={periodMonth}
                                onChange={handleDateChange}
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-[-20px]">
                    {activeTab === 'settlement' ? (
                        <Settlement
                            handleCheckDetail={handleCheckDetail}
                            handleImplement={handleImplement}
                            paginatedData={staffList}
                        />
                    ) : (
                        <Withdraw paginatedData={staffList} />
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

export default StripeAdminTab;
