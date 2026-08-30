import { useCallback, useEffect, useState } from "react";
import Button from "../input/button";
import Text from "../basic/text";
import FormTextInput from "../input/formTextInput";
import List from "../basic/list";
import App from "../../../app";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import RoomListEntry from "../../../../shared/room/types/roomListEntry";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import Form from "./form";
import DoorDestinationProps from "../../types/doorDestinationProps";
import { roomListDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import Spacer from "../basic/spacer";

//------------------------------------------------------------------------
// Where a door goes.
//
// Only hubs are offered. A hub is the world's public fabric — somewhere the game may put anybody
// down — whereas a regular room belongs to one person, and wiring a door into it would hand strangers
// a way into somebody's own room that its owner never agreed to. So there is nothing here to search
// through either: the hubs are few enough to read, and there is no second kind of room to sift them
// out of.
//
// A room is shown by its id and nothing else. An admin is wiring up a graph, and the id is the only
// thing about a hub that identifies it — a hub belongs to nobody, so any name it were given here
// would be one this form made up.
//
// Opening a new hub lives here because this is where the need for one is felt: an admin wiring a door
// up finds there is nowhere yet to wire it to.
//------------------------------------------------------------------------

export default function DestinationChooserForm({ initialDestinationRoomID, initialDestinationDoorLabel,
    onChooseRoom, onSetDoorLabel }: DoorDestinationProps)
{
    const [hubRooms, setHubRooms] = useState<RoomListEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [destinationRoomID, setDestinationRoomID] = useState<string>(initialDestinationRoomID);
    const [doorLabel, setDoorLabel] = useState<string>(initialDestinationDoorLabel);

    const loadHubs = useCallback(async () => {
        setLoading(true);

        // Debug mode: synthesize a long list of dummy entries instead of hitting the API, so the
        // list's scrolling can be exercised without a populated room database.
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

    // The room the door already points at is pinned above the rest and shown as the choice standing
    // rather than as one more room to pick. It may be a room the listing does not hold at all — a hub
    // that has since been taken down, or a regular room wired up before hubs became the only offer —
    // and it is still where the door goes, so it is shown as such rather than silently dropped.
    const listedDestination = hubRooms.find(r => r.id === destinationRoomID);
    const pinned: RoomListEntry[] = [];
    if (destinationRoomID.length > 0)
        pinned.push(listedDestination ?? makeUnlistedEntry(destinationRoomID));

    const items = [...pinned, ...hubRooms.filter(r => r.id !== destinationRoomID)];

    return <Form>
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

        {/* Which door of the destination the traveller arrives behind. Left empty, he arrives at
            whichever of its doors that room offers as its way in. */}
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

        {/* Where the admin is standing. Every room above is named by an id and nothing else, so
            without this there is no way to tell which of them he is wiring a door in — or to notice
            that he has just pointed a door back at the room it hangs in. */}
        <div className="flex flex-row items-center gap-1">
            <Text content="Current Room:" size="sm" additionalClassNames="shrink-0"/>
            <div className="yj-text-xs text-amber-300 min-w-0 text-left wrap-break-word">
                {App.getCurrentRoom()?.id ?? ""}
            </div>
        </div>

        <Button name="Create a New Hub" size="sm" color="green" additionalClassNames="shrink-0"
            onClick={handleCreateHub}/>
    </Form>;
}

function RoomEntryRow({ entry, isCurrentDestination, onChoose }: RowProps)
{
    return <div className="flex flex-row items-center justify-between gap-2 py-1 border-b border-gray-700">
        {/* min-w-0 lets the id column shrink past its longest word, and wrap-break-word lets that
            word itself break, so a long room id spills onto the next line instead of being clipped
            or pushing the button out of the row. */}
        <div className="yj-text-xs text-amber-300 min-w-0 text-left wrap-break-word">
            {`Room: ${entry.id}`}
        </div>
        {isCurrentDestination
            ? <div className="yj-text-xs text-gray-400 shrink-0">Selected</div>
            : <Button name="Select" size="xs" color="green" additionalClassNames="shrink-0"
                onClick={() => onChoose(entry)}/>}
    </div>;
}

// A destination the hub listing does not hold. It is still where the door points, and the id is all
// this form ever shows of a room anyway.
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
