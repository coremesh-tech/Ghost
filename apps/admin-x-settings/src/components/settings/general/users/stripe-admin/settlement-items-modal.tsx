import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Modal, Icon } from "@tryghost/admin-x-design-system";
import { useEffect, useState } from "react";
import SettlementItems from "./settlement-items";

interface SettlementItemsModalProps {
    item: any;
}

const SettlementItemsModal = NiceModal.create(({ item }: SettlementItemsModalProps) => {
    const modal = useModal();
    const [staffList, setStaffList] = useState<any>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const page_size = 10;

    useEffect(() => {
        getSettlementItems({ page_no: currentPage, page_size });
    }, []);

    const getSettlementItems = async ({ page_no,
        page_size }: any) => {
        try {
            const res = await fetch(`/ghost/api/admin/predict_mixin/admin_settlement_items?settlement_no=${item.settlement_no}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    settlement_no: item.settlement_no,
                    pagination: {
                        page_no,
                        page_size,
                    }
                })
            })
            if(!res.ok) {
                throw new Error('Failed to fetch settlement items');
            }
            const data = await res.json();
            if(data.predict_mixin?.[0]?.records?.length) {
                setStaffList(data.predict_mixin?.[0].records);
                setTotal(data.predict_mixin?.[0].total);
                setTotalPages(Math.ceil(data.predict_mixin?.[0].total / page_size));
            }
        } catch (error) {
            console.log(error);
        }
    }

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            getSettlementItems({ page_no: currentPage - 1, page_size });
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            getSettlementItems({ page_no: currentPage + 1, page_size });
        }
    };

    return (
        <Modal
            cancelLabel="Close"
            onCancel={() => modal.remove()}
            onOk={() => modal.remove()}
            title="Settlement Items"
        >
            <div className="flex flex-col gap-4">
                <SettlementItems paginatedData={staffList} />
                <div className="mt-6 flex items-center justify-between text-sm text-grey-700">
                    <div>
                        Showing {(currentPage - 1) * page_size + 1}-
                        {Math.min(currentPage * page_size, total)} of {total}
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
        </Modal>
    );
});

export default SettlementItemsModal;
