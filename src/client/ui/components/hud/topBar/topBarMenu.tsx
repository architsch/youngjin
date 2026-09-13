import { useEffect } from "react";
import IconButton from "../../input/iconButton";
import GearIcon from "../../../svg/icons/gearIcon";
import PowerIcon from "../../../svg/icons/powerIcon";
import GameModeToggleSwitch from "../mode/gameModeToggleSwitch";
import User from "../../../../../shared/user/types/user";
import Room from "../../../../../shared/room/types/room";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import { MINUTE_IN_MS } from "../../../../../shared/system/sharedConstants";
import PopupUtil from "../../../util/popupUtil";
import FTUEUtil from "../../../util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";

// Top bar (same in both modes): mode switch, room settings (for the superuser), exit. A non-interactive
// fade sits behind the controls so drags still reach the canvas. It sits below the headline, which
// can take the full width.

export default function TopBarMenu({ user, room, roomSettingsOpen, onToggleRoomSettings, onExitApp }: Props)
{
    // Superuser only (see RoomValidationUtil); not in single-player rooms, which aren't stored.
    const showRoomSettings = RoomValidationUtil.isRoomSuperuser(user, room) &&
        room.roomType != RoomTypeEnumMap.SinglePlayer;
    const inOwnRoom = RoomValidationUtil.userOwnsRoom(user, room);

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
        <IconButton id="exitAppButton" icon={<PowerIcon/>} size="sm" onClick={() => {
            // Guests only get a leave confirmation; account holders can also switch accounts.
            if (user.userType === UserTypeEnumMap.Guest)
            {
                PopupUtil.openPopup({popupType: "confirm", params: {
                    message: "Exit this app?",
                    onConfirm: () => {
                        PopupUtil.closePopup();
                        onExitApp();
                    },
                    onCancel: PopupUtil.closePopup,
                }});
            }
            else
            {
                PopupUtil.openPopup({popupType: "exitPrompt"});
            }
        }}/>
    </div>;
}

interface Props
{
    user: User;
    room: Room;
    roomSettingsOpen: boolean;
    onToggleRoomSettings: () => void;
    onExitApp: () => void;
}
