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
import { imageListChooserDebugEnabledObservable } from "../../../../shared/system/sharedObservables";

// Page = number of rows mounted at a time. Even though the metadata is fully in-memory,
// rendering every row up front (plus every thumbnail's network request) doesn't scale
// when the ImageMap holds many thousands of images.
const PAGE_SIZE = 30;

// Debug-only total — exercised when imageListChooserDebugEnabledObservable is on,
// to verify pagination/scroll on a list large enough to span many pages.
const DEBUG_DUMMY_IMAGE_TOTAL = 200;

export default function ImageListChooserForm({mapName, initialChoicePath, onChoose}: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;

    const resolvedInitialPath = (initialChoicePath && initialChoicePath.length > 0)
        ? initialChoicePath
        : imageMap.getFirstImagePath();

    const [selectedPath, setSelectedPath] = useState<string>(resolvedInitialPath);
    const [searchInput, setSearchInput] = useState<string>("");
    const [pageIndex, setPageIndex] = useState<number>(0);

    // All filtering happens client-side because every image's metadata is already
    // loaded into the ImageMap at startup. Debug mode swaps in a synthesized list so
    // pagination/scroll behavior can be exercised without a populated ImageMap.
    const filteredItems = useMemo(() => {
        const allItems = imageListChooserDebugEnabledObservable.peek()
            ? makeDummyImageList()
            : imageMap.getImageMetadataList();
        const query = searchInput.trim().toLowerCase();
        if (query.length === 0)
            return allItems;
        return allItems.filter(metadata =>
            metadata.title.toLowerCase().includes(query) ||
            metadata.author.toLowerCase().includes(query));
    }, [imageMap, searchInput]);

    // Reset pagination when the search query changes so the user doesn't see a
    // partially-paged view of the new result set.
    useEffect(() => {
        setPageIndex(0);
    }, [searchInput]);

    const visibleItems = useMemo(() =>
        filteredItems.slice(0, (pageIndex + 1) * PAGE_SIZE),
        [filteredItems, pageIndex]);
    const hasMore = visibleItems.length < filteredItems.length;

    const handleReachEnd = useCallback(() => {
        setPageIndex(p => p + 1);
    }, []);

    return <Form>
        <TextInput size="sm" placeholder="Search by title or author"
            textInput={searchInput} setTextInput={setSearchInput}/>

        <List<ImageMetadata>
            items={visibleItems}
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

function makeDummyImageList(): ImageMetadata[]
{
    const list: ImageMetadata[] = [];
    for (let i = 0; i < DEBUG_DUMMY_IMAGE_TOTAL; ++i)
    {
        list.push({
            path: `dummy-image-${i}`,
            title: `dummy_title_${i}`,
            author: `dummy_author_${i}`,
            coords: "0,0,0",
        });
    }
    return list;
}

interface Props
{
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
}
