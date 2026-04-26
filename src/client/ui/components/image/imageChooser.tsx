import { useCallback, useState } from "react";
import Button from "../basic/button";
import ImageChooserPopup from "./imageChooserPopup";

export default function ImageChooser({title, mapName, initialChoicePath, onChoose}: Props)
{
    const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

    const openPopup = useCallback(() => setIsPopupOpen(true), []);
    const closePopup = useCallback(() => setIsPopupOpen(false), []);

    const handleChoose = useCallback((path: string) => {
        onChoose(path);
        setIsPopupOpen(false);
    }, [onChoose]);

    return <>
        <div className="flex flex-row items-center gap-2">
            <Button name={title} size="xs" onClick={openPopup}/>
        </div>
        {isPopupOpen && <ImageChooserPopup
            title={title}
            mapName={mapName}
            initialChoicePath={initialChoicePath}
            onChoose={handleChoose}
            onCancel={closePopup}
        />}
    </>;
}

interface Props
{
    title: string;
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
}
