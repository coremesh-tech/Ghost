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
                        className="font-bold text-grey-700"
                        style={{ width: "150px"}}
                        valign="center"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150 }}
                        align="center"
                        valign="center"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "100px"}}
                        align="center"
                        valign="center"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "120px"}}
                        align="center"
                        valign="center"
                    >
                        Total Amount
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "150px"}}
                        align="center"
                        valign="center"
                    >
                        State
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 150}}
                        align="center"
                        valign="center"
                    >
                        Remark
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "200px"}}
                        align="center"
                        valign="center"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: "200px"}}
                        align="center"
                        valign="center"
                    >
                        Updated At
                    </TableCell>
                    <TableCell
                        className="font-bold text-grey-700 text-center"
                        style={{ width: 100}}
                        align="center"
                        valign="center"
                    >
                        Action
                    </TableCell>
                </div>
            }
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.id} separator={true} bgOnHover={false} onClick={() => handleCheckDetail(item)}>
                    <div className="flex w-full justify-between px-2 items-center">
                        <TableCell 
                            style={{ width: "150px"}}
                            valign="center"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150 }}
                            valign="center"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "100px"}}
                            valign="center"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "120px"}}
                            align="center"
                            valign="center"
                        >
                            {item.total_amount}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: 150}}
                            align="center"
                            valign="center"
                        >
                            {item.state}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "150px"}}
                            align="center"
                            valign="center"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "200px"}}
                            align="center"
                            valign="center"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "200px"}}
                            align="center"
                            valign="center"
                        >
                            {item.updated_at}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{ width: "100px"}}
                            align="center"
                            valign="center"
                        >
                            <Button
                                label="Funds Sharing"
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
