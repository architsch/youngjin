import { useCallback } from "react";
import IconButton from "../basic/iconButton";
import EditIcon from "../basic/icons/editIcon";
import ImageChooserProps from "../../types/imageChooserProps";
import PopupUtil from "../../util/popupUtil";

export default function ImageChooser({title, mapName, initialChoicePath, onChoose}: ImageChooserProps)
{
    const openPopup = useCallback(() => {
        PopupUtil.openPopup({
            popupType: "imageChooser",
            params: {title, mapName, initialChoicePath, onChoose},
        });
    }, [title, mapName, initialChoicePath, onChoose]);

    return <IconButton icon={<EditIcon/>} size="md" onClick={openPopup}/>;
}
