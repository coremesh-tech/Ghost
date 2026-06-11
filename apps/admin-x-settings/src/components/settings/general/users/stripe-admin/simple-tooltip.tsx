import {
    type FC,
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import {createPortal} from 'react-dom';

export interface SimpleTooltipProps {
    content: string;
    children: ReactNode;
    /**
     * 与触发元素的间距
     */
    offset?: number;
    /**
     * 最大宽度（避免超长内容撑开）
     */
    maxWidth?: number;
}

const SimpleTooltip: FC<SimpleTooltipProps> = ({
    content,
    children,
    offset = 6,
    maxWidth = 320
}) => {
    const triggerRef = useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number }>({
        top: 0,
        left: 0
    });

    const updatePosition = () => {
        const el = triggerRef.current;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        // 默认显示在上方居中
        setPos({
            top: rect.top - offset,
            left: rect.left + rect.width / 2
        });
    };

    useLayoutEffect(() => {
        if (!open) {
            return;
        }
        updatePosition();
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onScrollOrResize = () => {
            // 合并高频事件
            requestAnimationFrame(updatePosition);
        };

        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open]);

    return (
        <>
            <span
                ref={triggerRef}
                className="inline-block max-w-full"
                onBlur={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
            >
                {children}
            </span>
            {open &&
                createPortal(
                    <div
                        className="rounded-lg"
                        style={{
                            position: 'fixed',
                            top: pos.top,
                            left: pos.left,
                            transform: 'translate(-50%, -100%)',
                            zIndex: 9999
                        }}
                    >
                        <div
                            className={`max-w-[ rounded-lg bg-[#000000] p-4 text-[#FFFFFF]${maxWidth}px] overflow-auto text-sm font-medium`}
                        >
                            {content}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};

export default SimpleTooltip;
