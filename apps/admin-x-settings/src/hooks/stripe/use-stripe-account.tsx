import { useCallback, useEffect, useState } from "react";
import { useAccountState } from "../../components/providers/settings-app-provider";
import { showToast } from '@tryghost/admin-x-design-system';

const ACCOUNT_STATUS = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    COMPLETE: "COMPLETE",
    DISABLED: "DISABLED",
};

const useStripeAccount = () => {
    const accountState: any = useAccountState();
    const status = accountState?.view_state;
    const [activeTab, setActiveTab] = useState("income");
    const [staffWalletMe, setStaffWalletMe] = useState<any>({});
    const [staffList, setStaffList] = useState<any>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [cashLoading, setCashLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    const page_size = 10;
    const isPending = status && !(status === ACCOUNT_STATUS.PENDING);

    useEffect(() => {
        if (isPending) {
            getStaffWalletMe();
            getStaffList({ page_no: currentPage, page_size });
        }
    }, [isPending]);

    const statusText = (() => {
        switch (status) {
            case ACCOUNT_STATUS.PENDING:
                return "Pending";
            case ACCOUNT_STATUS.ACTIVE:
                return "Active";
            case ACCOUNT_STATUS.COMPLETE:
                return "Complete";
            case ACCOUNT_STATUS.DISABLED:
                return "Disabled";
            default:
                return "Unknown";
        }
    })();

    const handleConnect = useCallback(async (country: string) => {
        setConnecting(true);
        try {
            const response = await fetch(
                "/ghost/api/admin/predict_mixin/connect_url/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ country }),
                }
            );
            if (!response.ok) {
                throw new Error("Failed to get Stripe Connect URL");
            }
            const data = await response.json();
            const accountUrl = data.predict_mixin[0]?.accountUrl;
            if (accountUrl) {
                window.location.href = accountUrl;
            } else {
                throw new Error("No accountUrl received");
            }
        } catch (error: any) {
            console.error(error);
            showToast({
                title: "Failed to connect",
                message: error.message,
                type: "error",
            });
        } finally {
            setConnecting(false);
        }
    }, []);

    const getStaffWalletMe = async () => {
        try {
            const res = await fetch(
                "/ghost/api/admin/predict_mixin/staff_wallet_me"
            );
            if (!res.ok) {
                throw new Error("Failed to get Staff Wallet Me");
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                setStaffWalletMe(data.predict_mixin[0]);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const getStaffList = async ({ page_no, page_size, tab }: any) => {
        const url =
            (tab || activeTab) === "income"
                ? "/ghost/api/admin/predict_mixin/staff_income_me"
                : "/ghost/api/admin/predict_mixin/staff_payout_me";
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ page_no, page_size }),
            });
            if (!res.ok) {
                throw new Error(`Failed to get Staff ${tab || activeTab}`);
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]) {
                setStaffList(data.predict_mixin[0]?.records || []);
                setTotal(data.predict_mixin[0]?.total || 0);
                setTotalPages(
                    Math.ceil(
                        (data.predict_mixin[0]?.total || 0) /
                            data.predict_mixin[0]?.page_size || 1
                    )
                );
                setCurrentPage(data.predict_mixin[0]?.page_no || 1);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const accountUnbind = useCallback(async () => {
        const response = await fetch("/ghost/api/admin/predict_mixin/unbind/", {
            method: "GET",
        });
        if (!response.ok) {
            throw new Error("Failed to unbind Stripe account");
        }
        const data = await response.json();
        if (data && data.predict_mixin && data.predict_mixin[0].success) {
            window.location.reload();
        }
    }, []);

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

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setTotal(0);
        setTotalPages(0);
        setStaffList([]);
        getStaffList({ page_no: 1, page_size: page_size, tab });
    };

    const handleWithDrawCash = async () => {
      setCashLoading(true);
      try {
        const res = await fetch("/ghost/api/admin/predict_mixin/staff_withdraw_apply", {
          method: "POST",
        })
        if (!res.ok) {
          throw new Error("Failed to withdraw cash");
        }
        const data = await res.json();
        if (data && data.predict_mixin && data.predict_mixin[0]) {
          showToast({
              title: `Withdraw cash success`,
              message: `State ${data.predict_mixin[0].state}`,
              type: 'success'
          });
          getStaffWalletMe();
        }
      } catch(error: any) {
        showToast({
          title: `Withdraw cash failed`,
          message: `Error ${error.message}`,
          type: 'error'
        });
      } finally {
        setCashLoading(false);
      }
    }

    const handleLoginStripe = async () => {
        setLoginLoading(true);
        try {
            const res = await fetch("/ghost/api/admin/predict_mixin/vendor_login_links", {
                method: "GET",
            })
            if (!res.ok) {
                throw new Error("Failed to login Stripe account");
            }
            const data = await res.json();
            if (data && data.predict_mixin && data.predict_mixin[0]?.vendor_login_links) {
                window.open(data.predict_mixin[0].vendor_login_links, '_blank');
            }
        } catch(error: any) {
            showToast({
              title: `Login Stripe account failed`,
              message: `Error ${error.message}`,
              type: 'error'
            });
        } finally {
            setLoginLoading(false);
        }
    }

    return {
        status,
        isPending,
        activeTab,
        page_size,
        currentPage,
        total,
        totalPages,
        statusText,
        connecting,
        staffWalletMe,
        staffList,
        cashLoading,
        loginLoading,
        ACCOUNT_STATUS,
        handleConnect,
        handleNextPage,
        handlePrevPage,
        handleTabChange,
        accountUnbind,
        handleWithDrawCash,
        handleLoginStripe
    };
};

export default useStripeAccount;
