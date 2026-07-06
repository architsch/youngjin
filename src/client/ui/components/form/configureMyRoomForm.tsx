import { useCallback, useEffect, useState } from "react";
import Text from "../basic/text";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import Image from "../image/image";
import Spacer from "../basic/spacer";
import ImageChooser from "../image/imageChooser";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import App from "../../../app";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import RoomEditor from "../../../../shared/user/types/roomEditor";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import Form from "../basic/form";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import { editorListDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import IconButton from "../basic/iconButton";
import CloseIcon from "../basic/icons/closeIcon";
import CopyIcon from "../basic/icons/copyIcon";

export default function ConfigureMyRoomForm()
{
    const room = App.getCurrentRoom();
    const roomID = room?.id ?? "";
    const roomURL = `${window.location.origin}/${roomID}`;

    const [texturePackPath, setTexturePackPath] = useState(room?.texturePackPath ?? "");
    const [editorUserName, setEditorUserName] = useState("");
    const [editors, setEditors] = useState<RoomEditor[]>([]);

    const loadEditors = useCallback(async () => {
        if (editorListDebugEnabledObservable.peek())
        {
            const dummyEditors: RoomEditor[] = [];
            for (let i = 0; i < 16; ++i)
                dummyEditors.push({userName: `dummy_user_${i}`, email: `dummy_email_${i}@dummycompany.com`});
            setEditors(dummyEditors);
        }
        else
        {
            const response = await RoomAPIClient.getRoomEditors();
            if (response.status >= 200 && response.status < 300 && response.data.editors)
                setEditors(response.data.editors);
        }
    }, []);

    useEffect(() => { loadEditors(); }, []);

    const copyURL = useCallback(() => {
        navigator.clipboard.writeText(roomURL);
        notificationMessageObservable.set("Copied the URL!");
    }, [roomURL]);

    const setTexture = useCallback(async (path: string) => {
        if (!tryStartClientProcess("texturePackChange", 1, 0))
            return;
        try
        {
            const response = await RoomAPIClient.changeRoomTexture(path);
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
        else if (response.status === 409)
            notificationMessageObservable.set("This room has reached the maximum number of editors.");
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
        {/* Section 1: Room URL */}
        <Text content="My Room's URL:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            <div className="yj-text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded-md break-all select-all">{roomURL}</div>
            <IconButton icon={<CopyIcon/>} size="sm" onClick={copyURL}/>
        </div>

        <Spacer size="sm"/>

        {/* Section 2: Texture Pack */}
        <Text content="Texture Pack:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            {texturePackPath.length > 0 && <Image
                src={ImageMapUtil.getImageMap("TexturePackImageMap").getImageURLByPath(App.getEnv().assets_url, texturePackPath)}
                size="md" alt="Texture preview"/>}
            <ImageChooser
                title="Change Texture Pack"
                viewType="grid"
                mapName="TexturePackImageMap"
                initialChoicePath={texturePackPath}
                onChoose={(path) => setTexture(path)}
            />
        </div>

        <Spacer size="sm"/>

        {/* Section 3: Editors */}
        <Text content="Editors:" size="sm"/>
        <div className="flex flex-row items-center gap-1">
            <TextInput size="sm" placeholder="userName" currValue={editorUserName} setTextInput={setEditorUserName}/>
            <Button name="Add" size="sm" onClick={addEditor}/>
        </div>
        {editors.length > 0 && <div className="flex flex-col gap-1">
            {editors.map(editor => (
                <div key={editor.userName} className="flex flex-row items-center gap-1">
                    <Text size="sm" content={`${editor.userName} (${editor.email})`}/>
                    <IconButton icon={<CloseIcon/>} size="sm" color="red" onClick={() => removeEditor(editor.userName)}/>
                </div>
            ))}
        </div>}
    </Form>;
}