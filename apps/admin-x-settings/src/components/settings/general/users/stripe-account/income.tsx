import { Table, TableRow, TableCell } from "@tryghost/admin-x-design-system";
import OverflowTooltip from "../stripe-admin/overflow-tooltip";

interface Props {
    paginatedData?: any;
}

const Income = ({ paginatedData }: Props) => {
    return (
        <Table
            className="bg-transparent border-none"
            horizontalScroll={true}
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="font-bold text-grey-700 w-[150px]"
                        valign="middle"
                    >
                        Flow ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center w-[120px] md:w-[150px]"
                        align="center"
                        valign="middle"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 180 }}
                        align="center"
                        valign="middle"
                    >
                        Available Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100 }}
                        align="center"
                        valign="middle"
                    >
                        Fees
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
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Source Type
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="middle"
                    >
                        Source ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Remark
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.flow_no} separator={true} bgOnHover={false}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            className="w-[150px]"
                            valign="middle"
                        >
                            {item.flow_no}
                        </TableCell>
                        <TableCell
                            className="text-center w-[120px] md:w-[150px]"
                            valign="middle"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="middle"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 180 }}
                            align="center"
                            valign="middle"
                        >
                            {item.available_amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 100 }}
                            align="center"
                            valign="middle"
                        >
                            {item.fees}
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
                            style={{ width: 150 }}
                            align="center"
                            valign="middle"
                        >
                            {item.source_type}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="middle"
                        >
                            {item.source_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
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
