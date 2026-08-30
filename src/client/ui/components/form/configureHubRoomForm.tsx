import { useCallback, useState } from "react";
import Text from "../basic/text";
import Image from "../basic/image/image";
import ImageChooser from "../input/imageChooser";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import App from "../../../app";
import { notificationMessageObservable } from "../../../system/clientObservables";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import Form from "./form";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";

// A hub's settings, which are the game's own rather than any user's — so this is an admin's form,
// and it holds only what a room that belongs to nobody can have. There is no link to copy (a hub is
// reached through the doors that lead to it) and no editor list (a hub is everybody's to edit).
export default function ConfigureHubRoomForm()
{
    const room = App.getCurrentRoom();
    const roomID = room?.id ?? "";

    const [texturePackPath, setTexturePackPath] = useState(room?.texturePackPath ?? "");

    const setTexture = useCallback(async (path: string) => {
        if (!tryStartClientProcess("texturePackChange", 1, 0))
            return;
        try
        {
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

    return <Form>
        <Text content="Texture Pack:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            {texturePackPath.length > 0 && <Image
                src={ImageMapUtil.getImageMap("VoxelTexturePackImageMap").getImageURLByPath(App.getEnv().assets_url, texturePackPath)}
                size="md" alt="Texture preview"/>}
            <ImageChooser
                title="Change Texture Pack"
                viewType="grid"
                mapName="VoxelTexturePackImageMap"
                initialChoicePath={texturePackPath}
                onChoose={(path) => setTexture(path)}
            />
        </div>
    </Form>;
}
