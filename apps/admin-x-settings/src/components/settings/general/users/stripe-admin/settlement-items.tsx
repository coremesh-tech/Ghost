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
                        valign="center"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
                    >
                        Settlement Item ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        Transfer ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 160}}
                        valign="center"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 160}}
                        valign="center"
                    >
                        User Name
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 220}}
                        valign="center"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 220}}
                        valign="center"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 120}}
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 120}}
                        valign="center"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        State
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
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
                            valign="center"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 200}}
                            valign="center"
                        >
                            {item.settlement_item_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 150}}
                            valign="center"
                        >
                            {item.transfer_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 160}}
                            valign="center"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 160}}
                            valign="center"
                        >
                            {item?.username}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 220}}
                            valign="center"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 220}}
                            valign="center"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 120}}
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 120}}
                            valign="center"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="center"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="center"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="center"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
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
