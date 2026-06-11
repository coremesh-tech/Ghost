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
                        valign="center"
                    >
                        Withdraw ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
                    >
                        Payout ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 240}}
                        valign="center"
                    >
                        Ghost User ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
                    >
                        Vendor Account ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="center"
                    >
                        Apply Available Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 100}}
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
                        state
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        remark
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
                <TableRow key={item.withdraw_no} bgOnHover={false} separator={true}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell 
                            style={{width: 180}}
                            valign="center"
                        >
                            {item.withdraw_no}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="center"
                        >
                            {item.payout_no}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 240}}
                            valign="center"
                        >
                            {item.ghost_user_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="center"
                        >
                            {item.vendor_account_id}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="center"
                        >
                            {item.apply_available_amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 100}}
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

export default Payout;
