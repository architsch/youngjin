import { useCallback } from "react";
import IconButton from "../basic/iconButton";
import EditIcon from "../basic/icons/editIcon";
import ImageChooserProps from "../../types/imageChooserProps";
import { usePopup } from "../../contexts/popupContext";

export default function ImageChooser({title, mapName, initialChoicePath, onChoose}: ImageChooserProps)
{
    const popup = usePopup();

    const openPopup = useCallback(() => {
        popup.open({
            popupType: "imageChooser",
            params: {title, mapName, initialChoicePath, onChoose},
        });
    }, [popup, title, mapName, initialChoicePath, onChoose]);

    return <IconButton icon={<EditIcon/>} size="md" onClick={openPopup}/>;
}
