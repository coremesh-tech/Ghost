import { Table, TableRow, TableCell } from "@tryghost/admin-x-design-system";

interface Props {
    paginatedData?: any;
}

const Income = ({ paginatedData }: Props) => {
    return (
        <Table
            className="bg-transparent border-none"
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="flex-1 font-bold text-grey-700"
                        valign="center"
                    >
                        Date
                    </TableCell>
                    <TableCell
                        className="flex-1 font-bold text-grey-700 text-center"
                        align="center"
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="flex-1 font-bold text-grey-700 text-right"
                        align="right"
                        valign="center"
                    >
                        Status
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.id} separator={true} bgOnHover={false}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell className="flex-1" valign="center">
                            {item.date}
                        </TableCell>
                        <TableCell
                            className="flex-1 text-center"
                            align="center"
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="flex-1 text-right"
                            align="right"
                            valign="center"
                        >
                            {item.status}
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Income;
