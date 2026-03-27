import { Table, TableRow, TableCell } from "@tryghost/admin-x-design-system";

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
                        style={{ minWidth: "150px", flex: 1 }}
                        valign="center"
                    >
                        Date
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="center"
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-right"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="right"
                        valign="center"
                    >
                        Status
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-right"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="right"
                        valign="center"
                    >
                        Time1
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-right"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="right"
                        valign="center"
                    >
                        Time2
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-right"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="right"
                        valign="center"
                    >
                        Time3
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-right"
                        style={{ minWidth: "100px", flex: 1 }}
                        align="right"
                        valign="center"
                    >
                        Time4
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.id} separator={true} bgOnHover={false}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            style={{ minWidth: "150px", flex: 1 }}
                            valign="center"
                        >
                            {item.date}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="center"
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="right"
                            valign="center"
                        >
                            {item.status}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="right"
                            valign="center"
                        >
                            {item.time1}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="right"
                            valign="center"
                        >
                            {item.time2}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="right"
                            valign="center"
                        >
                            {item.time3}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            style={{ minWidth: "100px", flex: 1 }}
                            align="right"
                            valign="center"
                        >
                            {item.time4}
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Income;
