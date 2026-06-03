import { Table, TableRow, TableCell } from "@tryghost/admin-x-design-system";
import OverflowTooltip from "./overflow-tooltip";

interface Props {
    paginatedData?: any;
}

const SettlementItems = ({ paginatedData }: Props) => {
    return (
        <Table
            className="bg-transparent border-none"
            horizontalScroll={true}
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="font-bold text-grey-700"
                        style={{ width: 150 }}
                        valign="middle"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="middle"
                    >
                        Settlement Item ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Transfer ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 160 }}
                        align="center"
                        valign="middle"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 160 }}
                        align="center"
                        valign="middle"
                    >
                        User Name
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 220 }}
                        align="center"
                        valign="middle"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 220 }}
                        align="center"
                        valign="middle"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 120 }}
                        align="center"
                        valign="middle"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 120 }}
                        align="center"
                        valign="middle"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        State
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="middle"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="middle"
                    >
                        Updated At
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.settlement_no} separator={true} bgOnHover={false}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            style={{ width: 150 }}
                            valign="middle"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            valign="middle"
                        >
                            {item.settlement_item_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            valign="middle"
                        >
                            {item.transfer_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 160 }}
                            valign="middle"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 160 }}
                            valign="middle"
                        >
                            {item?.username}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 220 }}
                            valign="middle"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 220 }}
                            valign="middle"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 120 }}
                            align="center"
                            valign="middle"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 120 }}
                            valign="middle"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="middle"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="middle"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="middle"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="middle"
                        >
                            {item.updated_at}
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default SettlementItems;
