import { useCallback, useEffect, useRef, useState } from "react";
import Text from "../basic/text";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import CloseButton from "../basic/closeButton";
import List from "../basic/list";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import SocketsClient from "../../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../../shared/room/types/requestRoomChangeSignal";
import RoomListEntry from "../../../../shared/room/types/roomListEntry";
import { RoomTypeEnumMap, RoomType } from "../../../../shared/room/types/roomType";
import User from "../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";

// Sentinel ID used by the "My Room" placeholder entry when the user has no room yet.
// The Visit handler detects this and creates a room before joining.
const MY_ROOM_PLACEHOLDER_ID = "__my-room-placeholder__";

export default function RoomListForm({ user, currentRoomID, onClose }: Props)
{
    const [hubRoom, setHubRoom] = useState<RoomListEntry | null>(null);
    const [myRoom, setMyRoom] = useState<RoomListEntry | null>(null);
    const [otherRooms, setOtherRooms] = useState<RoomListEntry[]>([]);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [pageIndex, setPageIndex] = useState<number>(0);
    const [searchInput, setSearchInput] = useState<string>("");
    const [activeQuery, setActiveQuery] = useState<string>("");

    // Guards against overlapping loads when the user scrolls quickly (each load
    // increments pageIndex which would otherwise re-trigger the effect mid-flight).
    const loadingRef = useRef<boolean>(false);
    // Monotonically incremented per loadPage call. The response handler drops any
    // response whose captured generation is no longer current. This prevents stale
    // pages from committing to state when the query changes mid-flight.
    const loadGenerationRef = useRef<number>(0);

    const isGuest = user.userType === UserTypeEnumMap.Guest;
    const showMyRoomEntry = !isGuest;

    // IDs pinned at the top of the list — filtered out of the regular paginated list
    // so they don't appear twice.
    const pinnedIDs = new Set<string>();
    if (hubRoom) pinnedIDs.add(hubRoom.id);
    if (myRoom && myRoom.id !== MY_ROOM_PLACEHOLDER_ID) pinnedIDs.add(myRoom.id);

    // Load the special entries (Hub and My Room) — these are independent of pagination
    // and the search query.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const hubResponse = await RoomAPIClient.getHubRoom();
            if (!cancelled && hubResponse.status >= 200 && hubResponse.status < 300 && hubResponse.data?.room)
                setHubRoom(hubResponse.data.room as RoomListEntry);

            if (showMyRoomEntry)
            {
                const myResponse = await RoomAPIClient.getMyRoom();
                if (cancelled) return;
                if (myResponse.status >= 200 && myResponse.status < 300 && myResponse.data?.room)
                    setMyRoom(myResponse.data.room as RoomListEntry);
                else
                    setMyRoom(makeMyRoomPlaceholder());
            }
        })();
        return () => { cancelled = true; };
    }, [showMyRoomEntry]);

    // Reset and load the first page whenever the active query changes.
    useEffect(() => {
        setOtherRooms([]);
        setPageIndex(0);
        setHasMore(true);
        loadPage(0, activeQuery, /*append*/ false);
    // We intentionally exclude loadPage from deps — it's a stable closure pattern via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeQuery]);

    const loadPage = useCallback(async (page: number, query: string, append: boolean) => {
        const generation = ++loadGenerationRef.current;
        loadingRef.current = true;
        setLoading(true);
        const response = query.length > 0
            ? await RoomAPIClient.searchRooms(query, page)
            : await RoomAPIClient.listRooms(page);
        // Another loadPage started after us — our response is stale. Leave loading
        // state to the newer in-flight call to clear.
        if (generation !== loadGenerationRef.current) return;
        loadingRef.current = false;
        setLoading(false);
        if (response.status < 200 || response.status >= 300 || !Array.isArray(response.data?.rooms))
        {
            setHasMore(false);
            return;
        }
        const newRooms = response.data.rooms as RoomListEntry[];
        setOtherRooms(prev => append ? [...prev, ...newRooms] : newRooms);
        setHasMore(Boolean(response.data.hasMore));
    }, []);

    const handleReachEnd = useCallback(() => {
        if (loadingRef.current || !hasMore) return;
        const nextPage = pageIndex + 1;
        setPageIndex(nextPage);
        loadPage(nextPage, activeQuery, /*append*/ true);
    }, [pageIndex, hasMore, activeQuery, loadPage]);

    const submitSearch = useCallback(() => {
        setActiveQuery(searchInput.trim());
    }, [searchInput]);

    // When the input is fully cleared, fall back to the default (non-search) listing.
    useEffect(() => {
        if (searchInput.length === 0 && activeQuery.length > 0)
            setActiveQuery("");
    }, [searchInput, activeQuery]);

    const onSearchKeyDown = useCallback((ev: KeyboardEvent) => {
        if (ev.key === "Enter")
            submitSearch();
    }, [submitSearch]);

    useEffect(() => {
        window.addEventListener("keydown", onSearchKeyDown);
        return () => { window.removeEventListener("keydown", onSearchKeyDown); };
    }, [onSearchKeyDown]);

    const handleVisit = useCallback((entry: RoomListEntry) => {
        visitRoom(entry, user, onClose);
    }, [user, onClose]);

    // Pinned entries still honor the active search — a pinned room whose ownerUserName
    // doesn't match the query should disappear from search results the same way the
    // server omits non-matches from the paginated body.
    const pinned: RoomListEntry[] = [];
    if (hubRoom && pinnedMatchesQuery(hubRoom, activeQuery)) pinned.push(hubRoom);
    if (showMyRoomEntry && myRoom && pinnedMatchesQuery(myRoom, activeQuery)) pinned.push(myRoom);

    // Filter out pinned entries from the paginated list so they don't appear twice.
    const visibleOtherRooms = otherRooms.filter(r => !pinnedIDs.has(r.id));

    return <div className="flex flex-col gap-2 w-80 p-1">
        <div className="flex flex-row items-center justify-between">
            <Text content="Rooms" size="lg"/>
            <CloseButton onClose={onClose}/>
        </div>

        <List<RoomListEntry>
            items={visibleOtherRooms}
            getItemKey={(entry) => entry.id}
            renderItem={(entry) => <RoomEntryRow entry={entry} user={user} currentRoomID={currentRoomID} onVisit={handleVisit}/>}
            pinnedItems={pinned}
            renderPinnedItem={(entry) => <RoomEntryRow entry={entry} user={user} currentRoomID={currentRoomID} onVisit={handleVisit}/>}
            onReachEnd={handleReachEnd}
            hasMore={hasMore}
            loading={loading}
            emptyMessage={activeQuery.length > 0 ? "No rooms match your search." : "No rooms found."}
            maxHeightClassName="max-h-64"
        />

        <div className="flex flex-row items-center gap-1">
            <TextInput size="xs" placeholder="Search by user name"
                textInput={searchInput} setTextInput={setSearchInput}/>
            <Button name="Search" size="xs" onClick={submitSearch}/>
        </div>
    </div>;
}

function RoomEntryRow({ entry, user, currentRoomID, onVisit }: RowProps)
{
    const isMyRoom = entry.ownerUserID === user.id || entry.id === MY_ROOM_PLACEHOLDER_ID ||
        (user.ownedRoomID.length > 0 && user.ownedRoomID === entry.id);
    const ownerLabel = formatOwnerLabel(entry, isMyRoom);
    const idLabel = entry.id === MY_ROOM_PLACEHOLDER_ID ? "ID: ?" : `ID: ${entry.id}`;
    const isCurrentRoom = entry.id !== MY_ROOM_PLACEHOLDER_ID && entry.id === currentRoomID;

    return <div className="flex flex-row items-center justify-between gap-2 py-1 border-b border-gray-700">
        <div className="flex flex-col min-w-0">
            <div className="yj-text-xs text-amber-300 truncate">{ownerLabel}</div>
            <div className="yj-text-xs text-gray-400 truncate">{idLabel}</div>
        </div>
        {isCurrentRoom
            ? <div className="yj-text-xs text-gray-400">You are Here</div>
            : <Button name="Visit" size="xs" color="green" onClick={() => onVisit(entry)}/>}
    </div>;
}

function pinnedMatchesQuery(entry: RoomListEntry, query: string): boolean
{
    if (query.length === 0) return true;
    const name = entry.ownerUserName ?? "";
    return name.toLowerCase().includes(query.toLowerCase());
}

function formatOwnerLabel(entry: RoomListEntry, isMyRoom: boolean): string
{
    if (isMyRoom) return "My Room";
    if (entry.ownerUserName && entry.ownerUserName.length > 0)
        return `${entry.ownerUserName}'s Room`;
    if (entry.ownerUserID && entry.ownerUserID.length > 0)
        return "Unknown User's Room";
    return roomTypeName(entry.roomType);
}

function roomTypeName(roomType: RoomType): string
{
    if (roomType === RoomTypeEnumMap.Hub) return "Hub";
    return "Room";
}

function makeMyRoomPlaceholder(): RoomListEntry
{
    return {
        id: MY_ROOM_PLACEHOLDER_ID,
        roomType: RoomTypeEnumMap.Regular,
        ownerUserID: "",
        ownerUserName: "",
    };
}

async function visitRoom(entry: RoomListEntry, user: User, onClose: () => void): Promise<void>
{
    // Close the popup and engage the full-screen loading indicator immediately so
    // the user can't fire more interactions during the room-change round-trip.
    onClose();
    if (!tryStartClientProcess("roomChange", 1, 1))
        return;

    if (entry.id === MY_ROOM_PLACEHOLDER_ID)
    {
        // No room yet — create one first, then join.
        const response = await RoomAPIClient.createRoom();
        if (response.status >= 200 && response.status < 300 && response.data?.roomID)
        {
            const roomID = response.data.roomID as string;
            user.ownedRoomID = roomID;
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(roomID));
        }
        else
        {
            endClientProcess("roomChange");
            alert("Failed to create room. Please try again.");
        }
        return;
    }

    SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(entry.id));
}

interface Props
{
    user: User;
    currentRoomID: string;
    onClose: () => void;
}

interface RowProps
{
    entry: RoomListEntry;
    user: User;
    currentRoomID: string;
    onVisit: (entry: RoomListEntry) => void;
}
