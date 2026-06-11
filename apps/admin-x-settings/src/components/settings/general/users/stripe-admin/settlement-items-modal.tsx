import NiceModal, {useModal} from '@ebay/nice-modal-react';
import SettlementItems from './settlement-items';
import {Icon, Modal} from '@tryghost/admin-x-design-system';
import {useEffect, useState} from 'react';

interface SettlementItemsModalProps {
    item: any;
}

const SettlementItemsModal = NiceModal.create(({item}: SettlementItemsModalProps) => {
    const modal = useModal();
    const [staffList, setStaffList] = useState<any>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const pageSize = 10;

    useEffect(() => {
        getSettlementItems({pageNo: currentPage, pageSize});
    }, []);

    const getSettlementItems = async ({pageNo, pageSize: requestedPageSize}: any) => {
        try {
            const res = await fetch(`/ghost/api/admin/predict_mixin/admin_settlement_items?settlement_no=${item.settlement_no}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settlement_no: item.settlement_no,
                    pagination: {
                        page_no: pageNo,
                        page_size: requestedPageSize
                    }
                })
            });
            if (!res.ok) {
                throw new Error('Failed to fetch settlement items');
            }
            const data = await res.json();
            if (data.predict_mixin?.[0]?.records?.length) {
                setStaffList(data.predict_mixin?.[0].records);
                setTotal(data.predict_mixin?.[0].total);
                setTotalPages(Math.ceil(data.predict_mixin?.[0].total / requestedPageSize));
            }
        } catch {
            return;
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            getSettlementItems({pageNo: currentPage - 1, pageSize});
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            getSettlementItems({pageNo: currentPage + 1, pageSize});
        }
    };

    return (
        <Modal
            cancelLabel="Close"
            title="Settlement Items"
            onCancel={() => modal.remove()}
            onOk={() => modal.remove()}
        >
            <div className="flex flex-col gap-4">
                <SettlementItems paginatedData={staffList} />
                <div className="mt-6 flex items-center justify-between text-sm text-grey-700">
                    <div>
                        Showing {(currentPage - 1) * pageSize + 1}-
                        {Math.min(currentPage * pageSize, total)} of {total}
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
        </Modal>
    );
});

export default SettlementItemsModal;
