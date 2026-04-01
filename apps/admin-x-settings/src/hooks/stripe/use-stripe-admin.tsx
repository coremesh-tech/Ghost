import { useEffect, useRef, useState } from "react";
import { showToast } from "@tryghost/admin-x-design-system";
import NiceModal from "@ebay/nice-modal-react";
import SettlementItemsModal from "../../components/settings/general/users/stripe-admin/settlement-items-modal";

const getCurrentMonth = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
};

const useStripeAdmin = () => {
    const [activeTab, setActiveTab] = useState("settlement");
    const [staffList, setStaffList] = useState<any>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [periodMonth, setPeriodMonth] = useState(getCurrentMonth());
    const dateRef = useRef(null);

    const page_size = 10;

    useEffect(() => {
        getStaffList({ page_no: 1, page_size: page_size });
    }, []);

    const getStaffList = async ({
        page_no,
        page_size,
        tab,
        period_month,
    }: any) => {
        const url =
            (tab || activeTab) === "settlement"
                ? "/ghost/api/admin/predict_mixin/admin_settlement_list"
                : "/ghost/api/admin/predict_mixin/admin_withdraw_list";
        let params: any = {
            page_no,
            page_size,
        };
        if ((tab || activeTab) === "settlement") {
            params.period_month = period_month || periodMonth;
        }
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            });
            if (!res.ok) {
                throw new Error(`Failed to get Staff ${tab || activeTab}`);
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                setStaffList(data.predict_mixin[0]?.records || []);
                setTotal(data.predict_mixin[0]?.total);
                setTotalPages(
                    Math.ceil(
                        data.predict_mixin[0]?.total /
                            data.predict_mixin[0]?.page_size
                    )
                );
                setCurrentPage(data.predict_mixin[0]?.page_no || 1);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            getStaffList({
                page_no: currentPage + 1,
                page_size: page_size,
            });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            getStaffList({
                page_no: currentPage - 1,
                page_size: page_size,
            });
        }
    };

    const handleSetPage = (page: number) => {
        setCurrentPage(page);
        getStaffList({
            page_no: page,
            page_size: page_size,
        });
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setTotal(0);
        setTotalPages(0);
        setPeriodMonth(getCurrentMonth());
        setStaffList([]);
        getStaffList({ page_no: 1, page_size: page_size, tab });
    };

    const handleImplement = async (item: any) => {
        setStaffList((prev: any[]) =>
            prev.map((i: any) =>
                i.settlement_no === item.settlement_no ? { ...item, loading: true } : i
            )
        );
        try {
            const res = await fetch(
                "/ghost/api/admin/predict_mixin/admin_settlement_transfer",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        settlement_no: item?.settlement_no,
                    }),
                }
            );
            if (!res.ok) {
                throw new Error("Failed to admin_settlement_transfer");
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                showToast({
                    title: `Success`,
                    message: `State ${data.predict_mixin[0]?.state}`,
                    type: "success",
                });
                getStaffList({
                    page_no: currentPage,
                    page_size: page_size,
                    tab: activeTab,
                    period_month: periodMonth,
                });
            }
        } catch (error: any) {
            showToast({
                title: `Transfer failed`,
                message: `Error ${error.message}`,
                type: "error",
            });
        } finally {
            setStaffList((prev: any[]) =>
                prev.map((i: any) =>
                    i.settlement_no === item.settlement_no ? { ...item, loading: false } : i
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
            page_no: 1,
            page_size: page_size,
            tab: activeTab,
            period_month: e.target.value || getCurrentMonth(),
        });
    };

    const handleCheckDetail = (item: any) => {
        NiceModal.show(SettlementItemsModal, { item });
    };

    return {
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
        handleSetPage,
        handleTabChange,
        handleImplement,
        handleDateChange,
        handleCheckDetail,
    };
};

export default useStripeAdmin;
