import { useCallback, useEffect, useState } from "react";
import Text from "../basic/text";
import Button from "../input/button";
import TextInput from "../input/textInput";
import Image from "../basic/image/image";
import Spacer from "../basic/spacer";
import ImageChooser from "../input/imageChooser";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import App from "../../../app";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import RoomEditor from "../../../../shared/user/types/roomEditor";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import Form from "./form";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import { editorListDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import CopyIcon from "../../svg/icons/copyIcon";
import TooltipPanel from "../overlay/tooltipPanel";
import CompactIconButton from "../input/compactIconButton";
import QuestionMarkIcon from "../../svg/icons/questionMarkIcon";
import PopupUtil from "../../util/popupUtil";

export default function ConfigureMyRoomForm()
{
    const room = App.getCurrentRoom();
    const roomID = room?.id ?? "";
    const roomURL = `${window.location.origin}/${roomID}`;

    const [texturePackPath, setTexturePackPath] = useState(room?.texturePackPath ?? "");
    const [editorUserName, setEditorUserName] = useState("");
    const [editors, setEditors] = useState<RoomEditor[]>([]);
    const [tooltip, setTooltip] = useState<{targetElementId: string, text: string} | null>(null);

    // Only one section's explanation is up at a time — a click anywhere else takes the panel down
    // anyway, so a second one could only ever appear by clicking another section's "?" button,
    // which is also that click's chance to close the one already up.
    const toggleTooltip = useCallback((targetElementId: string, text: string) => {
        setTooltip(prev => prev?.targetElementId == targetElementId ? null : {targetElementId, text});
    }, []);
    const closeTooltip = useCallback(() => setTooltip(null), []);

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
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "Do you really want to ban this user from editing your room?",
                onConfirm: () => {
                    tryRemoveEditor(userName, loadEditors);
                    PopupUtil.closePopup();
                },
                onCancel: PopupUtil.closePopup
            }
        });
    }, [loadEditors]);

    return <Form>
        {/* Section 1: Room URL */}
        <div className="flex flex-row items-center">
            <CompactIconButton id="roomURLTooltipButton" icon={<QuestionMarkIcon/>} size="md" onClick={() => toggleTooltip(
                "roomURLTooltipButton",
                "Anyone with this link can visit your room.")}/>
            <Text content="Link to My Room:" size="sm"/>
        </div>
        <div className="flex flex-row items-center gap-1">
            <div className="yj-text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded-md break-all select-all yj-surface-concave">{roomURL}</div>
            <IconButton icon={<CopyIcon/>} size="sm" onClick={copyURL}/>
        </div>

        <Spacer size="sm"/>

        {/* Section 2: Voxel Texture Pack */}
        <div className="flex flex-row items-center">
            <CompactIconButton id="texturePackTooltipButton" icon={<QuestionMarkIcon/>} size="md" onClick={() => toggleTooltip(
                "texturePackTooltipButton",
                "Change your room's texture pack here.")}/>
            <Text content="Texture Pack:" size="sm"/>
        </div>
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

        <Spacer size="sm"/>

        {/* Section 3: Editors */}
        <div className="flex flex-row items-center">
            <CompactIconButton id="editorsTooltipButton" icon={<QuestionMarkIcon/>} size="md" onClick={() => toggleTooltip(
                "editorsTooltipButton",
                "Anyone in this list can edit your room.")}/>
            <Text content="Editors:" size="sm"/>
        </div>
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

        {/* Fixed to the viewport rather than laid out in the form, so it neither takes up a row of
            its own nor gets cut off by the form's scrolling. */}
        {tooltip && <TooltipPanel
            targetElementId={tooltip.targetElementId}
            text={tooltip.text}
            onDismiss={closeTooltip}
        />}
    </Form>;
}

async function tryRemoveEditor(userName: string, callback: () => void)
{
    const response = await RoomAPIClient.setRoomUserRole(userName, UserRoleEnumMap.Visitor);
    if (response.status >= 200 && response.status < 300)
    {
        notificationMessageObservable.set("Editor removed!");
        callback();
    }
    else
        notificationMessageObservable.set("Failed to remove editor.");
}