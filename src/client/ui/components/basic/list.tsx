import { ReactNode, UIEvent, useCallback, useEffect, useRef } from "react";

// Generic vertical list with optional infinite-scroll growth.
// Pinned items render at the top and are excluded from the scrolled body region's keying;
// the scrollable region uses item indices into `items` as keys.
export default function List<T>({ items, renderItem, getItemKey, pinnedItems = [],
    renderPinnedItem, onReachEnd, hasMore = false, loading = false,
    emptyMessage, scrollThresholdPx = 32, maxHeightClassName = "max-h-64" }: Props<T>)
{
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        if (!hasMore || loading || !onReachEnd) return;
        const el = event.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= scrollThresholdPx)
            onReachEnd();
    }, [hasMore, loading, onReachEnd, scrollThresholdPx]);

    // Edge case: the initial page may not fill the scroll container, so the scroll handler
    // never fires. Trigger another fetch as long as there's more and we're not already loading.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !hasMore || loading || !onReachEnd) return;
        if (el.scrollHeight <= el.clientHeight)
            onReachEnd();
    }, [items.length, hasMore, loading, onReachEnd]);

    return <div className={`flex flex-col w-full ${maxHeightClassName} overflow-y-auto`}
        ref={scrollRef} onScroll={handleScroll}>
        {pinnedItems.length > 0 && renderPinnedItem && <div className="flex flex-col">
            {pinnedItems.map((item, index) => (
                <div key={`pinned-${getItemKey ? getItemKey(item, index) : index}`}>
                    {renderPinnedItem(item, index)}
                </div>
            ))}
        </div>}
        <div className="flex flex-col">
            {items.map((item, index) => (
                <div key={getItemKey ? getItemKey(item, index) : index}>
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
        {items.length === 0 && pinnedItems.length === 0 && !loading && emptyMessage && (
            <div className="yj-text-xs text-gray-400 text-center py-2">{emptyMessage}</div>
        )}
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
    pinnedItems?: T[];
    renderPinnedItem?: (item: T, index: number) => ReactNode;
    onReachEnd?: () => void;
    hasMore?: boolean;
    loading?: boolean;
    emptyMessage?: string;
    scrollThresholdPx?: number;
    maxHeightClassName?: string;
}
