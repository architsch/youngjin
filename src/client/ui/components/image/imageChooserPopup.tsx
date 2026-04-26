import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Popup from "../basic/popup";
import Text from "../basic/text";
import Button from "../basic/button";
import CloseButton from "../basic/closeButton";
import ImageMapUtil from "../../../../shared/image/util/imageMapUtil";
import TabBar from "../basic/tabBar";
import ImageGrid from "./imageGrid";
import App from "../../../app";

export default function ImageChooserPopup({title, mapName, initialChoicePath, onChoose, onCancel}: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    
    initialChoicePath = (initialChoicePath && initialChoicePath.length > 0)
        ? initialChoicePath
        : imageMap.getFirstImagePath();

    const initialChoiceCoords = imageMap.getImageCoordsByPath(initialChoicePath);
    const words = initialChoiceCoords.split(",");

    const initialSubfolderName = words[0];
    const initialCol = parseInt(words[1]);
    const initialRow = parseInt(words[2]);

    // (selectedSubfolderName == "") if there is no subfolder.
    const [selectedSubfolderName, setSelectedSubfolderName] = useState<string>(initialSubfolderName);
    const [selectedCol, setSelectedCol] = useState<number>(initialCol);
    const [selectedRow, setSelectedRow] = useState<number>(initialRow);

    const onSelectSubfolder = useCallback((subfolder: string) => {
        
        if (subfolder === initialSubfolderName)
        {
            setSelectedCol(initialCol);
            setSelectedRow(initialRow);
        }
        else
        {
            setSelectedCol(0);
            setSelectedRow(0);
        }
        setSelectedSubfolderName(subfolder);
    }, [initialSubfolderName]);

    const overlay = <Popup>
        <div className="relative flex flex-col gap-2 w-80 p-1">
            <div className="flex flex-row items-center justify-between">
                <Text content={title} size="lg"/>
                <CloseButton onClose={onCancel}/>
            </div>

            {selectedSubfolderName.length > 0 && <TabBar
                tabNames={imageMap.getSubfolderNames()}
                selectedTabName={selectedSubfolderName}
                onSelect={onSelectSubfolder}/>}

            <ImageGrid
                imageURL={imageMap.getGridImageURL(App.getEnv().assets_url, selectedSubfolderName)}
                selectedCol={selectedCol}
                selectedRow={selectedRow}
                numCols={imageMap.getNumGridCols(selectedSubfolderName)}
                numRows={imageMap.getNumGridRows(selectedSubfolderName)}
                cellSize={imageMap.getGridCellSize()}
                onSelect={(col, row) => { setSelectedCol(col); setSelectedRow(row); }}/>

            <div className="flex flex-row items-center justify-center gap-2">
                <Button name="Choose" size="sm" color="green"
                    onClick={() => onChoose(imageMap.getImagePathByRawCoords(selectedSubfolderName, selectedCol, selectedRow))}/>
                <Button name="Cancel" size="sm" color="gray" onClick={onCancel}/>
            </div>
        </div>
    </Popup>;

    return createPortal(overlay, document.body);
}

interface Props
{
    title: string;
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
    onCancel: () => void;
}
