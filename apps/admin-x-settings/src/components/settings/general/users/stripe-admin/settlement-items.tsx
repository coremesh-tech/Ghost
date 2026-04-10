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
                        valign="center"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 160 }}
                        align="center"
                        valign="center"
                    >
                        Settlement Item ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Transfer ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 160 }}
                        align="center"
                        valign="center"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 220 }}
                        align="center"
                        valign="center"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 220 }}
                        align="center"
                        valign="center"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 120 }}
                        align="center"
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 120 }}
                        align="center"
                        valign="center"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        State
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="center"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="center"
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
                            valign="center"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 160 }}
                            valign="center"
                        >
                            {item.settlement_item_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            valign="center"
                        >
                            {item.transfer_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 160 }}
                            valign="center"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 220 }}
                            valign="center"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 220 }}
                            valign="center"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 120 }}
                            align="center"
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 120 }}
                            valign="center"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="center"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="center"
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
