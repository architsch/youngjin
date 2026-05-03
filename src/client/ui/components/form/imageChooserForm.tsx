import { useCallback, useState } from "react";
import Button from "../basic/button";
import ImageMapUtil from "../../../../shared/image/util/imageMapUtil";
import TabBar from "../basic/tabBar";
import ImageGrid from "../image/imageGrid";
import App from "../../../app";
import Form from "../basic/form";

export default function ImageChooserForm({mapName, initialChoicePath, onChoose, onClose}: Props)
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

    return <Form>
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

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-gray-600 flex flex-row items-center justify-center gap-2">
            <Button name="Choose" size="sm" color="green"
                onClick={() => onChoose(imageMap.getImagePathByRawCoords(selectedSubfolderName, selectedCol, selectedRow))}/>
            <Button name="Cancel" size="sm" color="gray" onClick={onClose}/>
        </div>
    </Form>;
}

interface Props
{
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
    onClose: () => void;
}
