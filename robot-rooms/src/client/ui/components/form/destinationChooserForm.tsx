import { useCallback, useEffect, useState } from "react";
import Button from "../input/button";
import Text from "../basic/text";
import FormTextInput from "../input/formTextInput";
import List from "../basic/list";
import App from "../../../app";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import RoomListEntry from "../../../../shared/room/types/roomListEntry";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import Form from "./form";
import DoorDestinationProps from "../../types/doorDestinationProps";
import { roomListDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import Spacer from "../basic/spacer";

// Door destination chooser. Lists hubs only (wiring doors into Regular rooms would let strangers into
// private rooms). Rooms are shown by id (hubs have no owner-given name). Also where admins open a new hub.

export default function DestinationChooserForm({ initialDestinationRoomID, initialDestinationDoorLabel,
    onChooseRoom, onSetDoorLabel }: DoorDestinationProps)
{
    const [hubRooms, setHubRooms] = useState<RoomListEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [destinationRoomID, setDestinationRoomID] = useState<string>(initialDestinationRoomID);
    const [doorLabel, setDoorLabel] = useState<string>(initialDestinationDoorLabel);

    const loadHubs = useCallback(async () => {
        setLoading(true);

        // Debug mode: dummy entries for testing list scrolling.
        if (roomListDebugEnabledObservable.peek())
        {
            setHubRooms(makeDummyHubRooms());
            setLoading(false);
            return;
        }

        const response = await RoomAPIClient.getHubRoomListEntries();
        setLoading(false);
        if (response.status >= 200 && response.status < 300 && Array.isArray(response.data?.rooms))
            setHubRooms(response.data.rooms as RoomListEntry[]);
    }, []);

    useEffect(() => { loadHubs(); }, [loadHubs]);

    const handleChoose = useCallback((entry: RoomListEntry) => {
        setDestinationRoomID(entry.id);
        onChooseRoom(entry.id);
    }, [onChooseRoom]);

    // Opens a hub and shows it in the list, so that a door can be pointed at it straight away.
    const handleCreateHub = useCallback(async () => {
        if (!tryStartClientProcess("hubCreation", 1, 0))
            return;
        try
        {
            const response = await RoomAPIClient.createRoom(RoomTypeEnumMap.Hub);
            if (response.status >= 200 && response.status < 300 && response.data?.roomID)
            {
                notificationMessageObservable.set("New hub created!");
                await loadHubs();
            }
            else
                notificationMessageObservable.set("Failed to create a hub.");
        }
        finally
        {
            endClientProcess("hubCreation");
        }
    }, [loadHubs]);

    // The current destination is pinned on top, even if it's not listed (e.g. a removed hub or a
    // Regular room from before hubs-only).
    const listedDestination = hubRooms.find(r => r.id === destinationRoomID);
    const pinned: RoomListEntry[] = [];
    if (destinationRoomID.length > 0)
        pinned.push(listedDestination ?? makeUnlistedEntry(destinationRoomID));

    const items = [...pinned, ...hubRooms.filter(r => r.id !== destinationRoomID)];

    return <Form id="doorDestinationForm">
        <List<RoomListEntry>
            items={items}
            getItemKey={(entry) => entry.id}
            renderItem={(entry) => <RoomEntryRow
                entry={entry}
                isCurrentDestination={entry.id === destinationRoomID}
                onChoose={handleChoose}
            />}
            loading={loading}
            emptyMessage="No hubs found."
            additionalClassNames="max-h-64 w-full"
        />

        {/* Arrival door label; empty = the room's default entrance. */}
        <FormTextInput
            label="Target Door:"
            size="sm"
            placeholder="Label"
            currValue={doorLabel}
            setTextInput={(text: string) => {
                setDoorLabel(text);
                onSetDoorLabel(text);
            }}
        />

        <Spacer size="sm"/>
        <hr/>
        <Spacer size="sm"/>

        {/* The current room's id, so it can be told apart (and self-pointing doors avoided). */}
        <div className="flex flex-row items-center gap-1">
            <Text content="Current Room:" size="sm" additionalClassNames="shrink-0"/>
            <div className="yj-text-xs text-amber-300 min-w-0 text-left wrap-break-word">
                {App.getCurrentRoom()?.id ?? ""}
            </div>
        </div>

        {RoomValidationUtil.userIsAdmin(App.getUser()) && <Button name="Create a New Hub" size="sm"
            color="green" additionalClassNames="shrink-0" onClick={handleCreateHub}/>}
    </Form>;
}

function RoomEntryRow({ entry, isCurrentDestination, onChoose }: RowProps)
{
    return <div className="flex flex-row items-center justify-between gap-2 py-1 border-b border-gray-700">
        {/* min-w-0 + wrap-break-word let long ids wrap instead of clipping or pushing the button out. */}
        <div className="yj-text-xs text-amber-300 min-w-0 text-left wrap-break-word">
            {`Room: ${entry.id}`}
        </div>
        {isCurrentDestination
            ? <div className="yj-text-xs text-gray-400 shrink-0">Selected</div>
            : <Button name="Select" size="xs" color="green" additionalClassNames="shrink-0"
                onClick={() => onChoose(entry)}/>}
    </div>;
}

// An entry for a destination not in the hub listing.
function makeUnlistedEntry(roomID: string): RoomListEntry
{
    return {id: roomID, roomType: RoomTypeEnumMap.Regular, ownerUserID: "", ownerUserName: ""};
}

// Debug-only dummy data, long enough that the list has to scroll.
const DEBUG_DUMMY_ROOM_TOTAL = 200;

function makeDummyHubRooms(): RoomListEntry[]
{
    const rooms: RoomListEntry[] = [];
    for (let i = 0; i < DEBUG_DUMMY_ROOM_TOTAL; ++i)
    {
        rooms.push({
            id: `dummy-room-${i}`,
            roomType: RoomTypeEnumMap.Hub,
            ownerUserID: "",
            ownerUserName: "",
        });
    }
    return rooms;
}

interface RowProps
{
    entry: RoomListEntry;
    isCurrentDestination: boolean;
    onChoose: (entry: RoomListEntry) => void;
}
