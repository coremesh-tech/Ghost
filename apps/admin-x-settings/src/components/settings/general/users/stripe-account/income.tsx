import OverflowTooltip from '../stripe-admin/overflow-tooltip';
import {Table, TableCell, TableRow} from '@tryghost/admin-x-design-system';

interface Props {
    paginatedData?: any;
}

const Income = ({paginatedData}: Props) => {
    return (
        <Table
            className="border-none bg-transparent"
            header={
                <div className="flex w-full items-center justify-between px-2">
                    <TableCell
                        className="w-[150px] font-bold text-grey-700"
                        valign="middle"
                    >
                        Flow ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="w-[120px] text-center font-bold text-grey-700 md:w-[150px]"
                        valign="middle"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 180}}
                        valign="middle"
                    >
                        Available Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 100}}
                        valign="middle"
                    >
                        Fees
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
                        style={{width: 150}}
                        valign="middle"
                    >
                        Source Type
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 200}}
                        valign="middle"
                    >
                        Source ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="middle"
                    >
                        Remark
                    </TableCell>
                </div>
            }
            horizontalScroll={true}
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.flow_no} bgOnHover={false} separator={true}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell 
                            className="w-[150px]"
                            valign="middle"
                        >
                            {item.flow_no}
                        </TableCell>
                        <TableCell
                            className="w-[120px] text-center md:w-[150px]"
                            valign="middle"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 180}}
                            valign="middle"
                        >
                            {item.available_amount}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 100}}
                            valign="middle"
                        >
                            {item.fees}
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
                            style={{width: 150}}
                            valign="middle"
                        >
                            {item.source_type}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 200}}
                            valign="middle"
                        >
                            {item.source_no}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 150}}
                            valign="middle"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Income;
