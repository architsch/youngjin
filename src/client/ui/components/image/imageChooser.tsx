import { useCallback } from "react";
import Button from "../basic/button";
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

    return <Button name={title} size="sm" onClick={openPopup}/>;
}
