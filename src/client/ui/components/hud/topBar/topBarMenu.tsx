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

//------------------------------------------------------------------------
// The strip along the top of the screen, holding what is about the session rather than about anything
// in the room: which mode the user is in, the way into the room's own settings where those are his to
// change, and the way out of the app.
//
// It is the same in both modes. Whatever the user is doing, the switch he flips to stop doing it and
// the button he leaves by are where he last found them — and the mode he is in is written on the
// switch, so the bar never has to be puzzled over to know what state the game is in.
//
// Behind the controls is a fade from black at the top edge to nothing at the bar's foot, which lets
// them sit over the 3D scene without a band cutting the scene off. The fade takes no input: it spans
// the width of the screen, and a strip that swallowed drags is a strip the user cannot swing the
// camera from, so only the controls themselves claim the pointer.
//
// It hangs below whatever height the headline currently reaches. The headline carries the tutorial's
// instructions and takes the full width whenever it has something to say, so a bar in the topmost
// row would be covered by the instruction telling the user to use it.
//------------------------------------------------------------------------

export default function TopBarMenu({ user, room, roomSettingsOpen, onToggleRoomSettings, onExitApp }: Props)
{
    // A room's own settings are its superuser's to change (see RoomValidationUtil): a Regular room's
    // owner, or an admin in a hub. A single-player room answers to its player as well, but it is
    // generated afresh each time and stored nowhere, so there would be nothing for its settings to be
    // saved to.
    const showRoomSettings = RoomValidationUtil.isRoomSuperuser(user, room) &&
        room.roomType != RoomTypeEnumMap.SinglePlayer;
    const inOwnRoom = RoomValidationUtil.userOwnsRoom(user, room);

    // The mark below keeps to the button it points at: it is scheduled while that button is on
    // offer, and taken back down once it is not. A mark is not taken off the list merely by its
    // target leaving the screen, so one left behind by a button that has gone would return the
    // moment the button did — skipping the wait that is supposed to earn it — which is why the
    // condition that puts it up is also the one that clears it away.
    useEffect(() => {
        if (!showRoomSettings || !inOwnRoom || FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings))
            return;

        // For any member-type user who has had the button within reach for 2 minutes straight,
        // we will show a coach mark for it if the user hasn't clicked it before.
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
            // A guest has no account to go anywhere else with, so the only thing worth asking is
            // whether they meant to leave at all. Everyone else is offered the fuller prompt, where
            // leaving is one answer and coming back as somebody else is the other.
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
