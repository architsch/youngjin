import { useEffect, useState } from "react";
import IconButton from "../../input/iconButton";
import GearIcon from "../../../svg/icons/gearIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import GameModeToggleSwitch from "../mode/gameModeToggleSwitch";
import User from "../../../../../shared/user/types/user";
import Room from "../../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import { MINUTE_IN_MS } from "../../../../../shared/system/sharedConstants";
import FTUEUtil from "../../../util/ftueUtil";
import OwnIdentityUtil from "../../../util/ownIdentityUtil";
import { FTUEElementCodeEnumMap } from "../../../../../shared/user/types/ftueElementCode";
import RoomEditorUtil from "../../../../singlePlayer/util/roomEditorUtil";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import { gameModeObservable, objectSelectionObservable } from "../../../../system/clientObservables";

// Top bar (same in both modes): mode switch, room settings (for the superuser), and the user's identity (see
// OwnIdentityUtil). A non-interactive fade sits behind the controls so drags still reach the canvas. It sits below the
// headline, which can take the full width.

export default function TopBarMenu({ user, room, roomSettingsOpen, onToggleRoomSettings }: Props)
{
    // Superuser only (see RoomValidationUtil); not in single-player rooms, which aren't stored, but for the one
    // being made in the room editor, whose settings go into its file.
    const showRoomSettings = RoomValidationUtil.isRoomSuperuser(user, room) &&
        (room.roomType != RoomTypeEnumMap.SinglePlayer || RoomEditorUtil.isEditing(room));
    const inOwnRoom = RoomValidationUtil.userOwnsRoom(user, room);
    // Signing in leaves the page, which a single-player room would have to be started over after.
    const showIdentity = room.roomType != RoomTypeEnumMap.SinglePlayer;

    const [identityShown, setIdentityShown] = useState<boolean>(OwnIdentityUtil.isShown());
    useEffect(() => {
        const update = () => {
            const shown = OwnIdentityUtil.isShown();
            setIdentityShown(shown);
            // Edit mode and the identity are experienced however they were opened, not only by these controls.
            if (GameModeUtil.isInEditMode())
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.EnterEditMode);
            if (shown)
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.OwnIdentity);
        };
        gameModeObservable.addListener("ui.topBarMenu", update);
        objectSelectionObservable.addListener("ui.topBarMenu", update);
        return () => {
            gameModeObservable.removeListener("ui.topBarMenu");
            objectSelectionObservable.removeListener("ui.topBarMenu");
        };
    }, []);

    // The coach mark is scheduled while the button is offered and cleared when it isn't, so it can't
    // reappear instantly when the button returns.
    useEffect(() => {
        if (!showRoomSettings || !inOwnRoom || FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings))
            return;

        // Coach mark after the button has been available for a while without being clicked.
        const timeout = setTimeout(() => {
            FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings,
                "roomSettingsButton", "View your room's settings here.");
        }, 2 * MINUTE_IN_MS);

        return () => {
            clearTimeout(timeout);
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.MyRoomSettings);
        };
    }, [showRoomSettings, inOwnRoom]);

    return <div className="absolute top-(--yj-headline-height,0px) inset-x-0 flex flex-row items-center justify-end gap-3 p-2 bg-linear-to-b from-black to-transparent pointer-events-none">
        <GameModeToggleSwitch/>
        {showRoomSettings && <IconButton id="roomSettingsButton" icon={<GearIcon/>} size="sm"
            highlight={roomSettingsOpen}
            onClick={() => {
                onToggleRoomSettings();
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings);
            }}
        />}
        {/* Pictured in messages by a hand-made copy (see ScreenControlPicture): a new icon or color goes there too. */}
        {showIdentity && <IconButton id="userIdentityButton" icon={<PersonIcon/>} size="sm"
            highlight={identityShown}
            onClick={OwnIdentityUtil.toggle}
        />}
    </div>;
}

interface Props
{
    user: User;
    room: Room;
    roomSettingsOpen: boolean;
    onToggleRoomSettings: () => void;
}
