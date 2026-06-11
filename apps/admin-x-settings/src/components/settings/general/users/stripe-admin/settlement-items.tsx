import OverflowTooltip from './overflow-tooltip';
import {Table, TableCell, TableRow} from '@tryghost/admin-x-design-system';

interface Props {
    paginatedData?: any;
}

const SettlementItems = ({paginatedData}: Props) => {
    return (
        <Table
            className="border-none bg-transparent"
            header={
                <div className="flex w-full items-center justify-between px-2">
                    <TableCell
                        className="font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Settlement Item ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Transfer ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 160}}
                        valign="middle"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 160}}
                        valign="middle"
                    >
                        User Name
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 220}}
                        valign="middle"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 220}}
                        valign="middle"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 120}}
                        valign="middle"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 120}}
                        valign="middle"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        State
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Updated At
                    </TableCell>
                </div>
            }
            horizontalScroll={true}
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.settlement_no} bgOnHover={false} separator={true}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell 
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.settlement_item_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.transfer_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 160}}
                            valign="middle"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 160}}
                            valign="middle"
                        >
                            {item?.username}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 220}}
                            valign="middle"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 220}}
                            valign="middle"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 120}}
                            valign="middle"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 120}}
                            valign="middle"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
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
