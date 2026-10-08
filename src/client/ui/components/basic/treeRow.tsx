import { PointerEvent, ReactNode } from "react";
import TriangleRightIcon from "../../svg/icons/triangleRightIcon";

// A row of a tree of nested things (see ImageCategoryTree), set in by how deep it is nested. One holding others
// has a triangle that folds them away and out again, which is its owner's to do. One given a dropTarget takes what
// is dragged onto it (see useGridReorder), and is lit while something is over it.
export default function TreeRow({ id, depth, expanded, onToggle, selected = false, dropTarget, onClick, onDoubleClick,
    onPointerDown, children }: Props)
{
    const holdsOthers = expanded != undefined;

    return <div id={id} data-drop-target={dropTarget} onClick={onClick} onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown} style={{paddingLeft: `${depth * INDENT_REM}rem`}}
        className={`flex flex-row items-center gap-1 h-7 pr-1.5 shrink-0 text-sm whitespace-nowrap rounded-sm ${onClick ? "cursor-pointer" : ""} ${selected ? "bg-gray-200 text-black" : "text-gray-200"} data-drop-over:bg-amber-400 data-drop-over:text-black`}>
        <div aria-hidden={!holdsOthers} onClick={holdsOthers ? event => {
                event.stopPropagation();
                onToggle?.();
            } : undefined}
            className={`size-4 p-0.5 shrink-0 ${holdsOthers ? "cursor-pointer" : "invisible"} ${expanded ? "rotate-90" : ""}`}>
            <TriangleRightIcon/>
        </div>
        {children}
    </div>;
}

// How far each level of nesting sets a row in.
const INDENT_REM = 1;

interface Props
{
    // Lets automation address the row.
    id?: string;
    // How many rows it is nested in.
    depth: number;
    // Whether the rows it holds are shown. Absent for a row that holds none, which has no triangle.
    expanded?: boolean;
    onToggle?: () => void;
    selected?: boolean;
    // What it tells the one who drops something on it, which makes it a drop target.
    dropTarget?: string;
    onClick?: () => void;
    onDoubleClick?: () => void;
    // For an owner that lets its rows be dragged (see useGridReorder).
    onPointerDown?: (event: PointerEvent) => void;
    // What the row says, after its triangle.
    children: ReactNode;
}
