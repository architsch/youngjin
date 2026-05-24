import { ReactNode, UIEvent, useCallback, useEffect, useRef } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

// Generic vertical list with optional infinite-scroll growth and mouse-drag scrolling.
// Consumers add layout styling (width, max-height, gap, padding) via `additionalClassNames`.
export default function List<T>({ items, renderItem, getItemKey,
    onReachEnd, hasMore = false, loading = false,
    emptyMessage, scrollThresholdPx = 32, additionalClassNames = "" }: Props<T>)
{
    const scrollElementRef = useRef<HTMLDivElement | null>(null);
    const dragScrollRef = useMouseDragScroll("vertical", "grabWhileDragging");

    // Merged ref: useMouseDragScroll wants a callback ref to attach its listeners;
    // we also need a regular ref so the "container too short to scroll" effect can
    // measure scrollHeight/clientHeight directly.
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

    // Edge case: the initial page may not fill the scroll container, so the scroll
    // handler never fires. Trigger another fetch as long as there's more and we're
    // not already loading.
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
