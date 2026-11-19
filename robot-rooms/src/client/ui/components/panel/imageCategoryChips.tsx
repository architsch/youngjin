import { useState } from "react";
import ImageMapCategory from "../../../../shared/graphics/image/types/imageMapCategory";
import Text from "../basic/text";
import Button from "../input/button";
import CompactIconButton from "../input/compactIconButton";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import PlusIcon from "../../svg/icons/plusIcon";

// The categories an admin files an image under, as chips (see AdminAssetSettingsEditor). A chip's X takes its
// category off; the plus offers the rest of the subfolder's, to put one on; and a chip pressed offers them in its
// own place. Only those not on are offered, so none is on twice.
export default function ImageCategoryChips({ id, categories, filedUnder, onChange }: Props)
{
    // What the category picked next does: joins the others, or takes the place of one of them.
    const [picking, setPicking] = useState<{replaced?: string} | null>(null);
    const offered = categories.filter(category => !filedUnder.includes(category.name));

    const pick = (name: string) => {
        onChange((picking?.replaced != undefined)
            ? filedUnder.map(other => (other == picking.replaced) ? name : other)
            : [...filedUnder, name]);
        setPicking(null);
    };

    // A chip is a well holding its category, and one whose place is being offered is lit as a button turned on is.
    return <div id={id} className="flex flex-row flex-wrap items-center gap-1.5">
        {filedUnder.length == 0 && <Text content="No category" size="xs"/>}
        {filedUnder.map(name => {
            const replaced = picking?.replaced == name;
            return <div key={name} id={`${id}.${name}`}
                className={`flex flex-row items-center gap-1 h-7.5 px-1.5 rounded-md text-sm select-none ${replaced ? "yj-panel-gray yj-panel-highlight" : "bg-gray-800 text-gray-200 yj-surface-concave"}`}>
                <span className={(offered.length > 0) ? "cursor-pointer" : ""}
                    onClick={(offered.length > 0) ? () => setPicking(replaced ? null : {replaced: name}) : undefined}>
                    {categories.find(category => category.name == name)?.title ?? name}
                </span>
                <CompactIconButton id={`${id}.${name}.remove`} icon={<CloseIcon/>} size="sm" onClick={() => {
                    onChange(filedUnder.filter(other => other != name));
                    setPicking(null);
                }}/>
            </div>;
        })}
        <IconButton id={`${id}.add`} icon={<PlusIcon/>} size="sm" disabled={offered.length == 0}
            highlight={picking != null && picking.replaced == undefined}
            onClick={() => setPicking((picking != null && picking.replaced == undefined) ? null : {})}/>
        {picking && offered.map(category => <Button key={category.name} id={`${id}.add.${category.name}`}
            name={category.title} size="sm" onClick={() => pick(category.name)}/>)}
    </div>;
}

interface Props
{
    // Lets automation address the chips: each category the image is under by its name (e.g.
    // "imageCategoryChips.kitchen"), that one's X (".kitchen.remove"), the plus (".add") and each category it
    // offers (".add.kitchen").
    id: string;
    // Its subfolder's, in tab order.
    categories: ImageMapCategory[];
    // Those it is under, in order: the first is the tab a chooser opens on for it.
    filedUnder: string[];
    onChange: (filedUnder: string[]) => void;
}
