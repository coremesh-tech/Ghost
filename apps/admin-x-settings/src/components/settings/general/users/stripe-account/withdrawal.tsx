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
            horizontalScroll={true}
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="font-bold text-grey-700"
                        style={{ width: 150 }}
                        valign="center"
                    >
                        Withdraw No
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
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        State
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 200 }}
                        align="center"
                        valign="center"
                    >
                        Created At
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
                            {item.withdraw_no}
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
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            align="center"
                            valign="center"
                        >
                            <div className="text-left break-all">{item.remark}</div>
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 200 }}
                            align="center"
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
