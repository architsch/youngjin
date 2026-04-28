import { useCallback, useEffect, useState } from "react";
import Text from "../basic/text";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import Image from "../image/image";
import CloseButton from "../basic/closeButton";
import Spacer from "../basic/spacer";
import ImageChooser from "../image/imageChooser";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import App from "../../../app";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import RoomEditor from "../../../../shared/user/types/roomEditor";
import ImageMapUtil from "../../../../shared/image/util/imageMapUtil";
import Form from "../basic/form";

export default function ConfigureMyRoomForm({ onClose }: Props)
{
    const room = App.getCurrentRoom();
    const roomID = room?.id ?? "";
    const roomURL = `${window.location.origin}/mypage/${roomID}`;

    const [texturePackPath, setTexturePackPath] = useState(room?.texturePackPath ?? "");
    const [editorUserName, setEditorUserName] = useState("");
    const [editors, setEditors] = useState<RoomEditor[]>([]);

    const loadEditors = useCallback(async () => {
        const response = await RoomAPIClient.getRoomEditors();
        if (response.status >= 200 && response.status < 300 && response.data.editors)
            setEditors(response.data.editors);
    }, []);

    useEffect(() => { loadEditors(); }, []);

    const copyURL = useCallback(() => {
        navigator.clipboard.writeText(roomURL);
        notificationMessageObservable.set("Copied the URL!");
    }, [roomURL]);

    const setTexture = useCallback(async (path: string) => {
        const response = await RoomAPIClient.changeRoomTexture(path);
        if (response.status >= 200 && response.status < 300)
        {
            setTexturePackPath(path);
            notificationMessageObservable.set("Texture pack updated!");
        }
        else
            notificationMessageObservable.set("Failed to update texture pack.");
    }, []);

    const addEditor = useCallback(async () => {
        if (!editorUserName.trim()) return;
        const response = await RoomAPIClient.setRoomUserRole(editorUserName.trim(), UserRoleEnumMap.Editor);
        if (response.status >= 200 && response.status < 300)
        {
            notificationMessageObservable.set("Editor added!");
            setEditorUserName("");
            loadEditors();
        }
        else
            notificationMessageObservable.set("Failed to add editor.");
    }, [editorUserName, loadEditors]);

    const removeEditor = useCallback(async (userName: string) => {
        if (!window.confirm("Do you really want to ban this user from editing your room?"))
            return;
        const response = await RoomAPIClient.setRoomUserRole(userName, UserRoleEnumMap.Visitor);
        if (response.status >= 200 && response.status < 300)
        {
            notificationMessageObservable.set("Editor removed!");
            loadEditors();
        }
        else
            notificationMessageObservable.set("Failed to remove editor.");
    }, [loadEditors]);

    return <Form>
        <CloseButton onClose={onClose}/>

        {/* Section 1: Room URL */}
        <Text content="My Room's URL:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            <div className="yj-text-xs text-gray-300 bg-gray-800 px-2 py-1 break-all select-all">{roomURL}</div>
            <Button name="Copy" size="xs" onClick={copyURL}/>
        </div>

        <Spacer size="sm"/>

        {/* Section 2: Texture Pack */}
        <Text content="Texture Pack:" size="sm"/>
        <ImageChooser
            title="Change Texture Pack"
            mapName="TexturePackImageMap"
            initialChoicePath={texturePackPath}
            onChoose={(path) => setTexture(path)}
        />
        {texturePackPath.length > 0 && <Image
            src={ImageMapUtil.getImageMap("TexturePackImageMap").getImageURLByPath(App.getEnv().assets_url, texturePackPath)}
            size="md" alt="Texture preview"/>}

        <Spacer size="sm"/>

        {/* Section 3: Editors */}
        <Text content="Editors:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            <TextInput size="xs" placeholder="userName" textInput={editorUserName} setTextInput={setEditorUserName}/>
            <Button name="Add" size="xs" onClick={addEditor}/>
        </div>
        {editors.length > 0 && <div className="flex flex-col gap-1">
            {editors.map(editor => (
                <div key={editor.userName} className="flex flex-row items-center gap-1">
                    <div className="yj-text-xs text-gray-300">{editor.userName} ({editor.email})</div>
                    <Button name="X" size="xs" color="red" onClick={() => removeEditor(editor.userName)}/>
                </div>
            ))}
        </div>}
    </Form>;
}

interface Props
{
    onClose: () => void;
}
