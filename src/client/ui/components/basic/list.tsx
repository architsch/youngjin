import { ReactNode, UIEvent, useCallback, useEffect, useRef } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

// Vertical list with optional infinite scroll and mouse-drag scrolling. Layout via additionalClassNames.
export default function List<T>({ items, renderItem, getItemKey,
    onReachEnd, hasMore = false, loading = false,
    emptyMessage, scrollThresholdPx = 32, additionalClassNames = "" }: Props<T>)
{
    const scrollElementRef = useRef<HTMLDivElement | null>(null);
    const dragScrollRef = useMouseDragScroll("vertical", "grabWhileDragging");

    // Callback ref for useMouseDragScroll plus a regular ref for measuring scroll height.
    const refCallback = useCallback((node: HTMLDivElement | null) => {
        scrollElementRef.current = node;
        dragScrollRef(node);
    }, [dragScrollRef]);

    const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        if (!hasMore || loading || !onReachEnd) return;
        const el = event.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= scrollThresholdPx)
            onReachEnd();
    }, [hasMore, loading, onReachEnd, scrollThresholdPx]);

    // If the first page doesn't fill the container, no scroll event fires, so fetch more.
    useEffect(() => {
        const el = scrollElementRef.current;
        if (!el || !hasMore || loading || !onReachEnd) return;
        if (el.scrollHeight <= el.clientHeight)
            onReachEnd();
    }, [items.length, hasMore, loading, onReachEnd]);

    return <div ref={refCallback} onScroll={handleScroll}
        className={`flex flex-col overflow-y-auto ${additionalClassNames}`}>
        {items.length === 0 && !loading && emptyMessage && (
            <div className="yj-text-xs text-gray-400 text-center py-2">{emptyMessage}</div>
        )}
        {items.map((item, index) => (
            <div key={getItemKey ? getItemKey(item, index) : index}>
                {renderItem(item, index)}
            </div>
        ))}
        {loading && (
            <div className="yj-text-xs text-gray-400 text-center py-2">Loading...</div>
        )}
    </div>;
}

interface Props<T>
{
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    getItemKey?: (item: T, index: number) => string | number;
    onReachEnd?: () => void;
    hasMore?: boolean;
    loading?: boolean;
    emptyMessage?: string;
    scrollThresholdPx?: number;
    additionalClassNames?: string;
}
