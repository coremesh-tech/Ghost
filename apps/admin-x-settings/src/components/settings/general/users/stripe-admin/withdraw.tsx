import OverflowTooltip from './overflow-tooltip';
import {Table, TableCell, TableRow} from '@tryghost/admin-x-design-system';

interface Props {
    paginatedData?: any;
}

const Payout = ({paginatedData}: Props) => {
    return (
        <Table
            className="border-none bg-transparent"
            header={
                <div className="flex w-full items-center justify-between px-2">
                    <TableCell
                        className="font-bold text-grey-700"
                        style={{width: 180}}
                        valign="middle"
                    >
                        Withdraw ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Payout ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 240}}
                        valign="middle"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Apply Available Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 100}}
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
                        state
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        remark
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
                <TableRow key={item.withdraw_no} bgOnHover={false} separator={true}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell 
                            style={{width: 180}}
                            valign="middle"
                        >
                            {item.withdraw_no}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.payout_no}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 240}}
                            valign="middle"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.apply_available_amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 100}}
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

export default Payout;
