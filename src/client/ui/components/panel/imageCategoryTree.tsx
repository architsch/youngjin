import { Fragment, useRef, useState } from "react";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMapCategory from "../../../../shared/graphics/image/types/imageMapCategory";
import ImageMapSettingsUtil from "../../../../shared/graphics/image/util/imageMapSettingsUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import PopupUtil from "../../util/popupUtil";
import { notificationMessageObservable } from "../../../system/clientObservables";
import TreeRow from "../basic/treeRow";
import IconButton from "../input/iconButton";
import NameInput from "../input/nameInput";
import ImageCategoryRows from "./imageCategoryRows";
import EditIcon from "../../svg/icons/editIcon";
import MinusIcon from "../../svg/icons/minusIcon";
import PlusIcon from "../../svg/icons/plusIcon";

// An image map's subfolders and, in each, the categories its images are browsed by, as a tree of folders (see
// AdminAssetSettingsEditor). A click selects a subfolder or a category. The buttons over the tree add a category to
// the subfolder selected (or to the selected category's), and delete or rename the category selected; a double
// click renames one too. A category's title is typed in its own row (see NameInput), and its letters and digits
// make its name. Deleting one takes every image out of it, and renaming one carries them along. A category
// dragged among its subfolder's others is put there in their order, which is their tabs' (see ImageCategoryRows).
// Each category says how many images are filed under it, and those of the subfolder selected are drop targets, by
// their names, for the images shown of it.
export default function ImageCategoryTree({ id, imageMap, subfolder, category, onSelect, onEdit,
    additionalClassNames = "" }: Props)
{
    const [rootFolded, setRootFolded] = useState<boolean>(false);
    const [foldedSubfolders, setFoldedSubfolders] = useState<string[]>([]);
    // The category being named: one renamed, or with none, a new one of that subfolder.
    const [naming, setNaming] = useState<{subfolder: string, renamed?: string} | null>(null);
    const wellRef = useRef<HTMLDivElement>(null);

    // As a file browser lists folders: by name.
    const subfolderNames = [...imageMap.getSubfolderNames()]
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    const selectedCategory = imageMap.getSubfolderCategories(subfolder).find(listed => listed.name == category);

    const startAdding = () => {
        setRootFolded(false);
        setFoldedSubfolders(folded => folded.filter(name => name != subfolder));
        setNaming({subfolder});
    };
    // Adds the category titled so, or gives the one being renamed that title, unless it can't be one.
    const nameCategory = (title: string): boolean => {
        if (naming == null)
            return false;
        const named = ImageMapSettingsUtil.toCategory(title);
        const problem = (naming.renamed != undefined)
            ? ImageChoiceUtil.renameCategory(imageMap, naming.subfolder, naming.renamed, named)
            : ImageChoiceUtil.addCategory(imageMap, naming.subfolder, named);
        if (problem != undefined)
        {
            notificationMessageObservable.set(problem);
            return false;
        }
        setNaming(null);
        onSelect(naming.subfolder, named.name);
        onEdit();
        return true;
    };
    const removeCategory = (name: string) => {
        ImageChoiceUtil.removeCategory(imageMap, subfolder, name);
        onSelect(subfolder);
        onEdit();
    };
    // Asked first when images would be taken out of it, which only filing each one again would undo.
    const confirmRemovingCategory = (removed: ImageMapCategory) => {
        const numFiled = ImageChoiceUtil.getNumFiled(imageMap, subfolder).get(removed.name) ?? 0;
        if (numFiled == 0)
        {
            removeCategory(removed.name);
            return;
        }
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: `Delete the category "${removed.title}"? ${numFiled} image${numFiled == 1 ? " is" : "s are"} filed under it.`,
                onConfirm: () => {
                    PopupUtil.closePopup();
                    removeCategory(removed.name);
                },
                onCancel: PopupUtil.closePopup,
            },
        });
    };

    const nameInput = (title: string) => <NameInput id={`${id}Name`} name={title} placeholder="Category name"
        onConfirm={nameCategory} onCancel={() => setNaming(null)} additionalClassNames="flex-1 min-w-0"/>;

    return <div id={id} className={`flex flex-col gap-1 ${additionalClassNames}`}>
        <div className="flex flex-row items-center gap-1.5 shrink-0">
            <IconButton id={`${id}Add`} icon={<PlusIcon/>} size="sm"
                highlight={naming != null && naming.renamed == undefined} onClick={startAdding}/>
            <IconButton id={`${id}Remove`} icon={<MinusIcon/>} size="sm" disabled={selectedCategory == undefined}
                onClick={() => confirmRemovingCategory(selectedCategory!)}/>
            <IconButton id={`${id}Rename`} icon={<EditIcon/>} size="sm" disabled={selectedCategory == undefined}
                highlight={naming?.renamed != undefined}
                onClick={() => setNaming({subfolder, renamed: selectedCategory!.name})}/>
        </div>
        <div ref={wellRef}
            className="flex flex-col flex-1 min-h-0 p-1 overflow-y-auto bg-gray-800 rounded-md yj-surface-concave yj-visible-scrollbar">
            <TreeRow depth={0} expanded={!rootFolded} onToggle={() => setRootFolded(!rootFolded)}>
                <span className="truncate">ImageMaps</span>
            </TreeRow>
            {!rootFolded && subfolderNames.map(name => {
                const folded = foldedSubfolders.includes(name);
                const categories = imageMap.getSubfolderCategories(name);
                const renamed = (naming?.subfolder == name)
                    ? categories.find(listed => listed.name == naming.renamed) : undefined;
                return <Fragment key={name}>
                    <TreeRow id={`${id}.${name}`} depth={1} expanded={!folded}
                        onToggle={() => setFoldedSubfolders(folded ? foldedSubfolders.filter(other => other != name)
                            : [...foldedSubfolders, name])}
                        selected={name == subfolder && selectedCategory == undefined} onClick={() => onSelect(name)}>
                        <span className="truncate">Subfolder "{name}"</span>
                        <span className="truncate opacity-50">{imageMap.getSubfolderTitle(name)}</span>
                    </TreeRow>
                    {!folded && <ImageCategoryRows id={`${id}.${name}`} categories={categories}
                        numFiled={ImageChoiceUtil.getNumFiled(imageMap, name)}
                        selected={(name == subfolder) ? category : undefined} renamed={renamed?.name}
                        nameInput={renamed && nameInput(renamed.title)} droppable={name == subfolder}
                        scrollerRef={wellRef}
                        onSelect={listed => onSelect(name, listed)}
                        onRename={listed => setNaming({subfolder: name, renamed: listed})}
                        onMove={(moved, position) => {
                            ImageChoiceUtil.moveCategory(imageMap, name, moved, position);
                            onEdit();
                        }}/>}
                    {!folded && naming?.subfolder == name && naming.renamed == undefined
                        && <TreeRow depth={2}>{nameInput("")}</TreeRow>}
                </Fragment>;
            })}
        </div>
    </div>;
}

interface Props
{
    // Lets automation address the tree: each subfolder's row by its name (e.g. "imageCategoryTree.2"), each
    // category's by its own after that (".2.kitchen"), the field a title is typed in ("imageCategoryTreeName"), and
    // the buttons that add, delete and rename a category ("imageCategoryTreeAdd", "imageCategoryTreeRemove",
    // "imageCategoryTreeRename").
    id: string;
    imageMap: ImageMap;
    // The subfolder selected, or the one the selected category is of.
    subfolder: string;
    // Absent when the subfolder itself is what is selected.
    category?: string;
    onSelect: (subfolder: string, category?: string) => void;
    // A category was added, renamed, deleted or put at another place.
    onEdit: () => void;
    additionalClassNames?: string;
}
