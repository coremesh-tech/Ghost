import OverflowTooltip from './overflow-tooltip';
import {Button, Table, TableCell, TableRow} from '@tryghost/admin-x-design-system';

interface Props {
    paginatedData?: any;
    handleImplement: (item: any) => void;
    handleCheckDetail: (item: any) => void;
}

const Settlement = ({paginatedData, handleImplement, handleCheckDetail}: Props) => {
    return (
        <Table
            className="border-none bg-transparent"
            header={
                <div className="flex w-full items-center justify-between px-2">
                    <TableCell
                        className="w-[130px] font-bold text-grey-700 md:w-[150px]"
                        valign="center"
                    >
                        Settlement ID
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 150}}
                        valign="center"
                    >
                        Settlement Month
                    </TableCell>
                    <TableCell
                        align="center"
                        className="w-[120px] text-center font-bold text-grey-700 md:w-[150px]"
                        valign="center"
                    >
                        Currency
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 160}}
                        valign="center"
                    >
                        Total Amount
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: '150px'}}
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
                        style={{width: '200px'}}
                        valign="center"
                    >
                        Created At
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: '200px'}}
                        valign="center"
                    >
                        Updated At
                    </TableCell>
                    <TableCell
                        align="center"
                        className="text-center font-bold text-grey-700"
                        style={{width: 130}}
                        valign="center"
                    >
                        Action
                    </TableCell>
                </div>
            }
            horizontalScroll={true}
        >
            {paginatedData.map((item: any) => (
                <TableRow key={item.settlement_no} bgOnHover={false} separator={true} onClick={() => handleCheckDetail(item)}>
                    <div className="flex w-full items-center justify-between px-2">
                        <TableCell 
                            className="w-[130px] md:w-[150px]"
                            valign="center"
                        >
                            {item.settlement_no}
                        </TableCell>
                        <TableCell
                            className="text-center"
                            style={{width: 150}}
                            valign="center"
                        >
                            {item.period_month}
                        </TableCell>
                        <TableCell
                            className="w-[120px] text-center md:w-[150px]"
                            valign="center"
                        >
                            {item.currency}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: 160}}
                            valign="center"
                        >
                            {item.total_amount}
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
                            style={{width: '150px'}}
                            valign="center"
                        >
                            <OverflowTooltip className="text-left" maxWidth={150} text={item.remark} />
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: '200px'}}
                            valign="center"
                        >
                            {item.created_at}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: '200px'}}
                            valign="center"
                        >
                            {item.updated_at}
                        </TableCell>
                        <TableCell
                            align="center"
                            className="text-center"
                            style={{width: '130px'}}
                            valign="center"
                        >
                            <Button
                                color="black"
                                disabled={item.state !== 'INIT'}
                                label="Settle"
                                loading={item.loading || false}
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
