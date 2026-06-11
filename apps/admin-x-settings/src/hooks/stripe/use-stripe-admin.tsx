import NiceModal from '@ebay/nice-modal-react';
import SettlementItemsModal from '../../components/settings/general/users/stripe-admin/settlement-items-modal';
import {showToast} from '@tryghost/admin-x-design-system';
import {useEffect, useRef, useState} from 'react';

const getCurrentMonth = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const useStripeAdmin = () => {
    const [activeTab, setActiveTab] = useState('settlement');
    const [staffList, setStaffList] = useState<any>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [periodMonth, setPeriodMonth] = useState(getCurrentMonth());
    const dateRef = useRef(null);

    const pageSize = 10;

    useEffect(() => {
        getStaffList({pageNo: 1, pageSize});
    }, []);

    const getStaffList = async ({
        pageNo,
        pageSize: requestedPageSize,
        tab,
        periodMonth: requestedPeriodMonth
    }: any) => {
        const url =
            (tab || activeTab) === 'settlement'
                ? '/ghost/api/admin/predict_mixin/admin_settlement_list'
                : '/ghost/api/admin/predict_mixin/admin_withdraw_list';
        let params: any = {
            page_no: pageNo,
            page_size: requestedPageSize
        };
        if ((tab || activeTab) === 'settlement') {
            params.period_month = requestedPeriodMonth || periodMonth;
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            if (!res.ok) {
                throw new Error(`Failed to get Staff ${tab || activeTab}`);
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                const {
                    page_size: responsePageSize = 1,
                    page_no: responsePageNo = 1
                } = data.predict_mixin[0];

                setStaffList(data.predict_mixin[0]?.records || []);
                setTotal(data.predict_mixin[0]?.total || 0);
                setTotalPages(
                    Math.ceil(
                        (data.predict_mixin[0]?.total || 0) /
                            responsePageSize
                    )
                );
                setCurrentPage(responsePageNo);
            }
        } catch {
            return;
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            getStaffList({
                pageNo: currentPage + 1,
                pageSize
            });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            getStaffList({
                pageNo: currentPage - 1,
                pageSize
            });
        }
    };

    const handleSetPage = (page: number) => {
        setCurrentPage(page);
        getStaffList({
            pageNo: page,
            pageSize
        });
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setTotal(0);
        setTotalPages(0);
        setPeriodMonth(getCurrentMonth());
        setStaffList([]);
        getStaffList({pageNo: 1, pageSize, tab});
    };

    const handleImplement = async (item: any) => {
        setStaffList((prev: any[]) => prev.map((i: any) => (i.settlement_no === item.settlement_no ? {...item, loading: true} : i)
        )
        );
        try {
            const res = await fetch(
                '/ghost/api/admin/predict_mixin/admin_settlement_transfer',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        settlement_no: item?.settlement_no
                    })
                }
            );
            if (!res.ok) {
                throw new Error('Failed to admin_settlement_transfer');
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                showToast({
                    title: `Success`,
                    message: `State ${data.predict_mixin[0]?.state}`,
                    type: 'success'
                });
                getStaffList({
                    pageNo: currentPage,
                    pageSize,
                    tab: activeTab,
                    periodMonth
                });
            }
        } catch (error: any) {
            showToast({
                title: `Transfer failed`,
                message: `Error ${error.message}`,
                type: 'error'
            });
        } finally {
            setStaffList((prev: any[]) => prev.map((i: any) => (i.settlement_no === item.settlement_no ? {...item, loading: false} : i)
            )
            );
        }
    };

    const handleDateChange = (e: any) => {
        setPeriodMonth(e.target.value || getCurrentMonth());
        setCurrentPage(1);
        setTotal(0);
        setTotalPages(0);
        getStaffList({
            pageNo: 1,
            pageSize,
            tab: activeTab,
            periodMonth: e.target.value || getCurrentMonth()
        });
    };

    const handleCheckDetail = (item: any) => {
        NiceModal.show(SettlementItemsModal, {item});
    };

    return {
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
        handleSetPage,
        handleTabChange,
        handleImplement,
        handleDateChange,
        handleCheckDetail
    };
};

export default useStripeAdmin;
