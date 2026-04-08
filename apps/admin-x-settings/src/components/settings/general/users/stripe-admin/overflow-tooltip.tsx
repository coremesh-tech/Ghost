import { useLayoutEffect, useRef, useState, type FC } from "react";
import SimpleTooltip from "./simple-tooltip";

export interface OverflowTooltipProps {
    text?: string;
    /**
     * 超过该宽度时显示省略号并启用 tooltip
     */
    maxWidth?: number;
    className?: string;
}

const OverflowTooltip: FC<OverflowTooltipProps> = ({
    text = "",
    maxWidth = 150,
    className,
}) => {
    const textRef = useRef<HTMLDivElement | null>(null);
    const [overflow, setOverflow] = useState(false);

    useLayoutEffect(() => {
        const el = textRef.current;
        if (!el) {
            return;
        }

        const check = () => {
            requestAnimationFrame(() => {
                const sw = el.scrollWidth;
                const cw = el.clientWidth;

                if (cw === 0) return;

                setOverflow(sw > cw);
            });
        };

        check();

        let ro: ResizeObserver | undefined;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(check);
            ro.observe(el);
        }

        window.addEventListener("resize", check);
        return () => {
            ro?.disconnect();
            window.removeEventListener("resize", check);
        };
    }, [text, maxWidth]);

    const content = (
        <div
            ref={textRef}
            className={className}
            style={{
                maxWidth,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {text}
        </div>
    );

    if (!text || !overflow) {
        return content;
    }

    return <SimpleTooltip content={text}>{content}</SimpleTooltip>;
};

export default OverflowTooltip;
