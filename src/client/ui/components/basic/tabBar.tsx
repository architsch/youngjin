import { useEffect, useRef } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

export default function TabBar({ id, tabNames, selectedTabName, onSelect, getTabLabel, size = "md",
    additionalClassNames = "" }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "grabWhileDragging");

    // Kept in view, or a bar opening on a tab past its edge wouldn't show which is picked.
    const selectedRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        // Both axes given: leaving one at its default scrolls every scrollable ancestor (see AtlasCellSprite).
        selectedRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }, [selectedTabName]);

    // The inner div scrolls. Putting overflow-x on the painted outer node would force overflow-y
    // to auto and clip its bottom edge in flex columns.
    return <div id={id} className={`bg-gray-800 ${paddingClassNames[size]} rounded-md yj-surface-concave ${additionalClassNames}`}>
        <div ref={onRefChange}
            className="flex flex-row gap-1 w-full overflow-x-auto no-scrollbar">
            {tabNames.map(tabName => {
                const isActive = tabName === selectedTabName;
                const baseClasses = "px-2 py-1 yj-text-xs cursor-pointer whitespace-nowrap rounded-sm";
                const stateClasses = isActive
                    ? "bg-gray-200 text-black"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600";
                return <div key={`tab-${tabName}`} id={id && `${id}.${tabName}`} ref={isActive ? selectedRef : undefined}
                    className={`${baseClasses} ${stateClasses}`}
                    onClick={() => onSelect(tabName)}>
                    {getTabLabel ? getTabLabel(tabName) : tabName}
                </div>;
            })}
        </div>
    </div>;
}

// "sm" is as tall as the "sm" size of IconButton and TextInput, to sit in a row with them.
const paddingClassNames = {
    sm: "p-0.5",
    md: "p-1",
};

interface Props
{
    // Lets automation address the bar, and each tab by its name (e.g. "propImageOptionsCategories.food").
    id?: string;
    tabNames: string[];
    selectedTabName: string;
    onSelect: (tabName: string) => void;
    getTabLabel?: (tabName: string) => string; // The name itself if absent.
    size?: "sm" | "md";
    // Layout within the owner (e.g. shrink-0 in a column).
    additionalClassNames?: string;
}
