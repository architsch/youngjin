import { useCallback } from "react";
import { enableHorizontalDragScroll } from "../../util/mouseScroll";

export default function TabBar({ tabNames, selectedTabName, onSelect }: Props)
{
    const onRefChange = useCallback((node: HTMLDivElement | null) => {
        if (node) enableHorizontalDragScroll(node);
    }, []);
    return <div ref={onRefChange}
        className="flex flex-row gap-1 w-full overflow-x-auto no-scrollbar bg-gray-800 p-1">
        {tabNames.map(tabName => {
            const isActive = tabName === selectedTabName;
            const baseClasses = "px-2 py-1 yj-text-xs cursor-pointer whitespace-nowrap";
            const stateClasses = isActive
                ? "bg-gray-200 text-black"
                : "bg-gray-700 text-gray-200 hover:bg-gray-600";
            return <div key={`tab-${tabName}`}
                className={`${baseClasses} ${stateClasses}`}
                onClick={() => onSelect(tabName)}>
                {tabName}
            </div>;
        })}
    </div>;
}

interface Props
{
    tabNames: string[];
    selectedTabName: string;
    onSelect: (tabName: string) => void;
}
