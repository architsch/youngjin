import LocalRoomFileUtil from "../../../system/util/localRoomFileUtil";
import Text from "../basic/text";
import IconButton from "../input/iconButton";
import FloppyDiskIcon from "../../svg/icons/floppyDiskIcon";
import OpenFolderIcon from "../../svg/icons/openFolderIcon";
import ScrollPanel from "./scrollPanel";

// Room file panel (see CustomizeRoomPanel): one button saves the room to a file, the other loads a file
// over the room (see RoomFile), once the user has seen the room it holds and said so.
export default function RoomFilePanel({ anchorElementId, onClose }: Props)
{
    return <ScrollPanel id="roomFileOptions" anchorElementId={anchorElementId} onClose={onClose}>
        <div className={COLUMN_CLASS_NAMES}>
            <div className="flex flex-row items-center gap-1.5">
                <Text content="Save Room as a File" size="sm" additionalClassNames="px-0 whitespace-nowrap"/>
                <IconButton id="saveRoomFileButton" icon={<FloppyDiskIcon/>} size="sm"
                    onClick={LocalRoomFileUtil.saveRoomFile}/>
            </div>
            <div className="flex flex-row items-center gap-1.5">
                <Text content="Load Room from a File" size="sm" additionalClassNames="px-0 whitespace-nowrap"/>
                <IconButton id="loadRoomFileButton" icon={<OpenFolderIcon/>} size="sm"
                    onClick={LocalRoomFileUtil.previewRoomFile}/>
            </div>
        </div>
    </ScrollPanel>;
}

// One action per line, right-aligned so the buttons line up.
const COLUMN_CLASS_NAMES = "flex flex-col items-end gap-1 shrink-0";

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
