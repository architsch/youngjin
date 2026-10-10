import { useCallback, useState } from "react";
import App from "../../../app";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import { NUM_VOXEL_TEXTURE_COLS, NUM_VOXEL_TEXTURE_ROWS } from "../../../../shared/system/sharedConstants";
import Image from "../basic/image/image";
import ImageChooser from "../input/imageChooser";
import TooltipButton from "../input/tooltipButton";
import ScrollPanel from "./scrollPanel";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";

// Texture pack panel (see CustomizeRoomPanel). Choosing another pack opens the chooser; the server
// decides whether the change is allowed.
export default function TexturePackPanel({ anchorElementId, onClose }: Props)
{
    const room = App.getCurrentRoom();
    const roomID = room?.id ?? "";

    const [texturePackPath, setTexturePackPath] = useState(room?.texturePackPath ?? "");

    const setTexture = useCallback(async (path: string) => {
        if (!tryStartClientProcess("texturePackChange", 1, 0))
            return;
        try
        {
            // A single-player room is no server's to re-skin: the room editor's is, as it stands.
            const currentRoom = App.getCurrentRoom();
            if (currentRoom && currentRoom.roomType == RoomTypeEnumMap.SinglePlayer)
            {
                currentRoom.texturePackPath = path;
                await ClientVoxelManager.applyVoxelTexturePack(path);
                setTexturePackPath(path);
                return;
            }
            const response = await RoomAPIClient.changeRoomTexture(path, roomID);
            if (response.status >= 200 && response.status < 300)
            {
                setTexturePackPath(path);
                notificationMessageObservable.set("Texture pack updated!");
            }
            else
                notificationMessageObservable.set("Failed to update texture pack.");
        }
        finally
        {
            endClientProcess("texturePackChange");
        }
    }, [roomID]);

    return <ScrollPanel id="texturePackOptions" anchorElementId={anchorElementId} onClose={onClose}>
        {/*<TooltipButton id="texturePackTooltipButton" additionalClassNames="self-center"
            text="What the blocks of your room are finished in. Choosing another pack re-skins the whole room at once."/>
        */}
        <div className="flex flex-row items-center gap-2 shrink-0">
            {texturePackPath.length > 0 && <Image
                src={ImageMapUtil.getImageMap("VoxelTexturePackImageMap").getImageURLByPath(App.getEnv().assets_url, texturePackPath)}
                size="md" aspectRatio={NUM_VOXEL_TEXTURE_COLS / NUM_VOXEL_TEXTURE_ROWS} alt="Texture preview"/>}
            <ImageChooser
                id="changeTexturePackButton"
                title="Change Texture Pack"
                mapName="VoxelTexturePackImageMap"
                initialChoicePath={texturePackPath}
                onChoose={(path) => setTexture(path)}
            />
        </div>
    </ScrollPanel>;
}

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
