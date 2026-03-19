import { Table, TableRow, TableCell } from "@tryghost/admin-x-design-system";
import closeCircleLine from "../../../../../assets/images/close-circle-line.svg";
import checkboxCircleLine from "../../../../../assets/images/checkbox-circle-line.svg";
import timeLine from "../../../../../assets/images/time-line.svg";

interface Props {
    paginatedData?: any;
}

const renderStatus = (status: string) => {
    switch (status) {
        case "succeeded":
            return <img src={checkboxCircleLine} alt="succeeded" />;
        case "pedding":
            return <img src={timeLine} alt="pedding" />;
        case "failed":
            return <img src={closeCircleLine} alt="failed" />;
        default:
            return null;
    }
};

const Withdrawal = ({ paginatedData }: Props) => {
    return (
        <Table
            className="bg-transparent border-none"
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="flex-2 flex items-center justify-start font-bold text-grey-700"
                        valign="center"
                    >
                        Date
                    </TableCell>
                    <TableCell
                        className="flex-1 flex items-center justify-start font-bold text-grey-700"
                        align="center"
                        valign="center"
                    >
                        Amount
                    </TableCell>
                    <TableCell
                        className="flex-1 flex items-center justify-end font-bold text-grey-700"
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
                        <TableCell
                            className="flex-2 items-center justify-start"
                            valign="center"
                        >
                            {item.date}
                        </TableCell>
                        <TableCell
                            className="flex-1 flex items-center justify-start"
                            align="center"
                            valign="center"
                        >
                            {item.amount}
                        </TableCell>
                        <TableCell
                            className="flex-1 flex items-center justify-end"
                            align="right"
                            valign="center"
                        >
                            {renderStatus(item.status)}
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Withdrawal;
