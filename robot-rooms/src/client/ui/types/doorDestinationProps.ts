export default interface DoorDestinationProps
{
    // Current destination room (pinned at the top), or "" if none.
    initialDestinationRoomID: string;
    // Arrival door label in that room, or "" for its default entrance.
    initialDestinationDoorLabel: string;
    onChooseRoom: (roomID: string) => void;
    onSetDoorLabel: (label: string) => void;
}
