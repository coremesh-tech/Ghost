import OverflowTooltip from '../stripe-admin/overflow-tooltip';
import {Table, TableCell, TableRow} from '@tryghost/admin-x-design-system';
interface Props {
    paginatedData?: any;
}

const Withdrawal = ({paginatedData}: Props) => {
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
                        Withdraw ID
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
                        style={{width: 150}}
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
                </div>
            }
            horizontalScroll={true}
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.withdraw_no} bgOnHover={false} separator={true}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell
                            style={{width: 150}}
                            valign="center"
                        >
                            {item.withdraw_no}
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
                            style={{width: 150}}
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
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Withdrawal;
