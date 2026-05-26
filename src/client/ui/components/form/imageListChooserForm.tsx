import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import List from "../basic/list";
import ImageListRow from "../image/imageListRow";
import ImageMapUtil from "../../../../shared/image/util/imageMapUtil";
import ImageMetadata from "../../../../shared/image/types/imageMetadata";
import App from "../../../app";
import Form from "../basic/form";
import PopupUtil from "../../util/popupUtil";
import ImageListChooserUtil from "../../util/imageListChooserUtil";

export default function ImageListChooserForm({mapName, initialChoicePath, onChoose}: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;

    const resolvedInitialPath = (initialChoicePath && initialChoicePath.length > 0)
        ? initialChoicePath
        : imageMap.getFirstImagePath();

    const allItems = ImageListChooserUtil.getShuffledAllItems(imageMap, resolvedInitialPath);

    const [selectedPath, setSelectedPath] = useState<string>(resolvedInitialPath);
    const [searchInput, setSearchInput] = useState<string>("");
    const [pageIndex, setPageIndex] = useState<number>(0);

    // Update 'filteredItems' whenever 'searchInput' changes.
    const filteredItems = useMemo(() =>
        ImageListChooserUtil.getFilteredItems(allItems, searchInput)
    , [allItems, searchInput]);

    // Update 'pageIndex' whenever 'filteredItems' changes.
    useEffect(() => {
        setPageIndex(0/*ImageListChooserUtil.getInitialPageIndex(
            filteredItems, selectedPath, searchInput)*/);
    }, [filteredItems]);

    // Update 'pageItems' whenever 'pageIndex' changes.
    const pageItems = useMemo(() =>
        ImageListChooserUtil.getPageItems(filteredItems, pageIndex)
    , [filteredItems, pageIndex]);
    
    // Update 'hasMore' whenever 'pageIndex' changes.
    const hasMore = useMemo(() =>
        ImageListChooserUtil.hasMore(filteredItems, pageIndex)
    , [filteredItems, pageIndex]);

    // Update 'pageIndex' whenever the scroll reaches to bottom and there are more items to load.
    const handleReachEnd = useCallback(() => {
        setPageIndex(p => p + 1);
    }, []);

    return <Form>
        <TextInput size="sm" placeholder="Search by title or author"
            textInput={searchInput} setTextInput={setSearchInput}/>

        <List<ImageMetadata>
            items={pageItems}
            getItemKey={(metadata) => metadata.path}
            renderItem={(metadata) => <ImageListRow
                imageURL={imageMap.getImageURLByPath(assetsURL, metadata.path)}
                title={metadata.title}
                author={metadata.author}
                selected={metadata.path === selectedPath}
                autoScrollToSelected={true}
                onClick={() => setSelectedPath(metadata.path)}
            />}
            onReachEnd={handleReachEnd}
            hasMore={hasMore}
            emptyMessage="No images match your search."
            additionalClassNames="gap-2 m-2 p-2 w-[60vw] max-w-[480px] max-h-[60vh] rounded-md pointer-events-auto"
        />

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-gray-600 rounded-b-lg flex flex-row items-center justify-center gap-2">
            <Button name="Choose" size="sm" color="green"
                onClick={() => {
                    onChoose(selectedPath);
                    PopupUtil.closePopup();
                }}/>
            <Button name="Cancel" size="sm" color="gray" onClick={PopupUtil.closePopup}/>
        </div>
    </Form>;
}

interface Props
{
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
}
