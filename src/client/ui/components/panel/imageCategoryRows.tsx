import { ReactNode, RefObject, useRef } from "react";
import ImageMapCategory from "../../../../shared/graphics/image/types/imageMapCategory";
import useGridReorder from "../../util/gridReorder";
import TreeRow from "../basic/treeRow";

// A subfolder's categories as rows of the tree they are listed in (see ImageCategoryTree), in the order of their
// tabs, each with the number of images filed under it. A click selects one and a double click renames it; one
// dragged is selected too, and is put where it is dropped among the others (see useGridReorder). Where droppable,
// each takes what is dragged onto it, by its name.
export default function ImageCategoryRows({ id, categories, numFiled, selected, renamed, nameInput, droppable = false,
    scrollerRef, onSelect, onRename, onMove }: Props)
{
    const rowsRef = useRef<HTMLDivElement>(null);
    const holdRow = useGridReorder(rowsRef, scrollerRef, position => onSelect(categories[position].name),
        (from, to) => onMove(categories[from].name, to));

    return <div ref={rowsRef} className="relative flex flex-col shrink-0">
        {categories.map((category, position) => {
            const naming = category.name == renamed;
            return <TreeRow key={category.name} id={`${id}.${category.name}`} depth={2}
                selected={!naming && category.name == selected} dropTarget={droppable ? category.name : undefined}
                onClick={naming ? undefined : () => onSelect(category.name)}
                onDoubleClick={naming ? undefined : () => onRename(category.name)}
                onPointerDown={naming ? undefined : event => holdRow(event, position)}>
                {naming ? nameInput : <>
                    <span className="truncate">{category.title}</span>
                    <span className="shrink-0 opacity-50">({numFiled.get(category.name) ?? 0})</span>
                </>}
            </TreeRow>;
        })}
    </div>;
}

interface Props
{
    // Lets automation address each category's row by its name after this (e.g. "imageCategoryTree.2.kitchen").
    id: string;
    // In tab order.
    categories: ImageMapCategory[];
    // How many images each is filed under, by its name. One left out has none.
    numFiled: Map<string, number>;
    // The names of the one selected and of the one being renamed, if any.
    selected?: string;
    renamed?: string;
    // What the row of the one being renamed shows in its title's place.
    nameInput?: ReactNode;
    // Whether the rows are drop targets (see TreeRow).
    droppable?: boolean;
    // What scrolls the rows.
    scrollerRef: RefObject<HTMLElement | null>;
    onSelect: (name: string) => void;
    onRename: (name: string) => void;
    // A row was dropped at another place of the order, which the owner gives back as its categories so rearranged.
    onMove: (name: string, position: number) => void;
}
