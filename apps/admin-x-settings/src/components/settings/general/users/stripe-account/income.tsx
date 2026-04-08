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
                        className="font-bold text-grey-700"
                        style={{ width: 150 }}
                        valign="center"
                    >
                        Flow ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100 }}
                        align="center"
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100 }}
                        align="center"
                        valign="center"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 170 }}
                        align="center"
                        valign="center"
                    >
                        Available Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100 }}
                        align="center"
                        valign="center"
                    >
                        Fees
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100 }}
                        align="center"
                        valign="center"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Source Type
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="center"
                    >
                        Source ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Remark
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.id} separator={true} bgOnHover={false}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            style={{ width: 150 }}
                            valign="center"
                        >
                            {item.flow_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 100 }}
                            align="center"
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 100 }}
                            align="center"
                            valign="center"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 170 }}
                            align="center"
                            valign="center"
                        >
                            {item.available_amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 100 }}
                            align="center"
                            valign="center"
                        >
                            {item.fees}
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
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
                        >
                            {item.source_type}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
                            valign="center"
                        >
                            {item.source_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
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
