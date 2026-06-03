import { Table, TableRow, TableCell, Button } from "@tryghost/admin-x-design-system";
import OverflowTooltip from "./overflow-tooltip";

interface Props {
    paginatedData?: any;
    handleImplement: (item: any) => void;
    handleCheckDetail: (item: any) => void;
}

const Settlement = ({ paginatedData, handleImplement, handleCheckDetail }: Props) => {
    return (
        <Table
            className="bg-transparent border-none"
            horizontalScroll={true}
            header={
                <div className="flex w-full justify-between px-2 items-center">
                    <TableCell
                        className="font-bold text-grey-700 w-[130px] md:w-[150px]"
                        valign="middle"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="middle"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center w-[120px] md:w-[150px]"
                        align="center"
                        valign="middle"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 160 }}
                        align="center"
                        valign="middle"
                    >
                        Total Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "150px"}}
                        align="center"
                        valign="middle"
                    >
                        State
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150}}
                        align="center"
                        valign="middle"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "200px"}}
                        align="center"
                        valign="middle"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "200px"}}
                        align="center"
                        valign="middle"
                    >
                        Updated At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 130}}
                        align="center"
                        valign="middle"
                    >
                        Action
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.settlement_no} separator={true} bgOnHover={false} onClick={() => handleCheckDetail(item)}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            className="w-[130px] md:w-[150px]"
                            valign="middle"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            valign="middle"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center w-[120px] md:w-[150px]"
                            valign="middle"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 160 }}
                            align="center"
                            valign="middle"
                        >
                            {item.total_amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150}}
                            align="center"
                            valign="middle"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "150px"}}
                            align="center"
                            valign="middle"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "200px"}}
                            align="center"
                            valign="middle"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "200px"}}
                            align="center"
                            valign="middle"
                        >
                            {item.updated_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "130px"}}
                            align="center"
                            valign="middle"
                        >
                            <Button
                                label="Settle"
                                loading={item.loading || false}
                                disabled={item.state !== "INIT"}
                                color="black"
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    handleImplement(item);
                                }}
                            />
                        </TableCell>
                    </div>
                </TableRow>
            ))}
        </Table>
    );
};

export default Settlement;
