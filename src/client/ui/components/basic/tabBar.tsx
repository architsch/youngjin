import useMouseDragScroll from "../../util/mouseDragScroll";

export default function TabBar({ tabNames, selectedTabName, onSelect }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "grabWhileDragging");

    // The outer wrapper owns bg/padding and stays a normal block so it does not
    // become a scroll container. Setting `overflow-x` on the same node that paints
    // the bg would force `overflow-y` to `auto` per spec, which clips descenders
    // and the bottom edge by a few pixels in flex column ancestors. The inner div
    // is the actual horizontal scroller.
    return <div className="bg-gray-800 p-1 shrink-0">
        <div ref={onRefChange}
            className="flex flex-row gap-1 w-full overflow-x-auto no-scrollbar">
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
        </div>
    </div>;
}

interface Props
{
    tabNames: string[];
    selectedTabName: string;
    onSelect: (tabName: string) => void;
}
