import clsx from 'clsx';
import React from 'react';
import {PaginationData} from '../hooks/use-pagination';
import Heading from './heading';
import Hint from './hint';
import {LoadingIndicator} from './loading-indicator';
import Pagination from './pagination';
import Separator from './separator';
import TableRow from './table-row';

export interface ShowMoreData {
    hasMore: boolean;
    loadMore: () => void;
}

export interface TableProps {
    /**
     * If the table is the primary content on a page (e.g. Members table) then you can set a pagetitle to be consistent
     */
    header?: React.ReactNode;
    pageTitle?: string;
    children?: React.ReactNode;
    borderTop?: boolean;
    hint?: React.ReactNode;
    hintSeparator?: boolean;
    className?: string;
    isLoading?: boolean;
    pagination?: PaginationData;
    showMore?: ShowMoreData;
    fillContainer?: boolean;
    horizontalScroll?: boolean;
    paddingXClassName?: string;
}

const OptionalPagination = ({pagination}: {pagination?: PaginationData}) => {
    if (!pagination) {
        return null;
    }

    return <Pagination {...pagination}/>;
};

const OptionalShowMore = ({showMore}: {showMore?: ShowMoreData}) => {
    if (!showMore) {
        return null;
    } else if (!showMore.hasMore) {
        return <div></div>;
    }

    return (
        <div className={`text-green mt-1 flex items-center gap-2 text-sm font-bold hover:text-green-400`}>
            <button type='button' onClick={showMore.loadMore}>Show all</button>
        </div>
    );
};

const Table: React.FC<TableProps> = ({
    header,
    children,
    borderTop,
    hint,
    hintSeparator,
    pageTitle,
    className,
    pagination,
    showMore,
    isLoading,
    fillContainer = false,
    horizontalScroll = false,
    paddingXClassName
}) => {
    const table = React.useRef<HTMLTableSectionElement>(null);
    const maxTableHeight = React.useRef(0);
    const [tableHeight, setTableHeight] = React.useState<number | undefined>(undefined);

    const multiplePages = pagination && pagination.pages && pagination.pages > 1;

    // Observe the height of the table content. This is used to:
    // 1) avoid layout jumps when loading a new page of the table
    // 2) keep the same table height between pages, cf. https://github.com/TryGhost/Product/issues/3881
    React.useEffect(() => {
        if (table.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                const height = entries[0].target.clientHeight;
                setTableHeight(height);

                if (height > maxTableHeight.current) {
                    maxTableHeight.current = height;
                }
            });

            resizeObserver.observe(table.current);

            return () => {
                resizeObserver.disconnect();
            };
        }
    }, [isLoading, pagination]);

    const mainContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (horizontalScroll && mainContainerRef.current) {
                // If it's mainly a vertical scroll (e.deltaY != 0 and deltaX == 0)
                // and the container can actually scroll horizontally
                const container = mainContainerRef.current;
                const canScrollHorizontally = container.scrollWidth > container.clientWidth;
                
                if (canScrollHorizontally && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    // Prevent default vertical scroll and scroll horizontally instead
                    e.preventDefault();
                    container.scrollLeft += e.deltaY;
                }
            }
        };

        const container = mainContainerRef.current;
        if (container && horizontalScroll) {
            container.addEventListener('wheel', handleWheel, {passive: false});
        }

        return () => {
            if (container && horizontalScroll) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [horizontalScroll]);

    const loadingStyle = React.useMemo(() => {
        if (tableHeight === undefined) {
            return {
                height: 'auto'
            };
        }

        return {
            height: maxTableHeight.current
        };
    }, [tableHeight]);

    const spaceHeightStyle = React.useMemo(() => {
        if (tableHeight === undefined) {
            return {
                height: 0
            };
        }

        return {
            height: maxTableHeight.current - tableHeight
        };
    }, [tableHeight]);

    const headerClasses = clsx(
        'border-grey-200 dark:border-grey-600 h-9 border-b'
    );

    /**
     * To have full-bleed scroll try this:
     * - unset width of table
     * - set minWidth of table to 100%
     * - set side padding of table to 40px
     * - unset tableContainer width
     * - set minWidth of tableContainer to 100%
     * - unset mainContainer width
     * - set minWidth of mainContainer to 100%
     * - set side margins of outer container to -40px
     * - set footer side paddings to 40px
     */

    const tableClasses = clsx(
        'w-full',
        fillContainer ? 'min-w-full' : 'w-full',
        (borderTop || pageTitle) && 'border-grey-300 border-t',
        pageTitle ? 'mb-0 mt-14' : 'my-0',
        className
    );

    const mainContainerClasses = clsx(
        horizontalScroll ? 'overflow-x-auto' : '',
        fillContainer ? 'absolute inset-0 min-w-full' : 'w-full'
    );

    const tableContainerClasses = clsx(
        fillContainer ? 'max-h-[calc(100%-38px)] w-full overflow-y-auto' : 'w-full',
        paddingXClassName
    );

    const footerClasses = clsx(
        'sticky bottom-0 -mt-px bg-white pb-3 dark:bg-black',
        paddingXClassName
    );

    return (
        <>
            <div ref={mainContainerRef} className={mainContainerClasses}>
                {pageTitle && <Heading>{pageTitle}</Heading>}

                <div className={tableContainerClasses}>
                    <table className={tableClasses}>
                        {header && <thead className={headerClasses}>
                            <TableRow bgOnHover={false} separator={false}>{header}</TableRow>
                        </thead>}
                        {!isLoading && <tbody ref={table}>
                            {children}
                        </tbody>}

                        {multiplePages && <div style={spaceHeightStyle} />}
                    </table>
                </div>

                {isLoading && <div className='p-5'><LoadingIndicator delay={200} size='lg' style={loadingStyle} /></div>}

                {(hint || pagination || showMore) &&
                    <footer className={footerClasses}>
                        {(hintSeparator || pagination) && <Separator />}
                        <div className="mt-1 flex flex-col-reverse items-start justify-between gap-1 pt-2 md:flex-row md:items-center md:gap-0 md:pt-0">
                            <OptionalShowMore showMore={showMore} />
                            <Hint>{hint ?? ' '}</Hint>
                            <OptionalPagination pagination={pagination} />
                        </div>
                    </footer>}
            </div>
        </>
    );
};

export default Table;
