import { useCallback } from "react";
import IconButton from "./iconButton";
import EditIcon from "../../svg/icons/editIcon";
import ImageChooserProps from "../../types/imageChooserProps";
import PopupUtil from "../../util/popupUtil";

export default function ImageChooser(imageChooserProps: ImageChooserProps)
{
    const openPopup = useCallback(() => {
        PopupUtil.openPopup({
            popupType: "imageChooser",
            params: imageChooserProps,
        });
    }, [imageChooserProps]);

    return <IconButton icon={imageChooserProps.icon ?? <EditIcon/>} size="md" onClick={openPopup}/>;
}
