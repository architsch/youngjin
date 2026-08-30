export default interface DoorDestinationProps
{
    // The room this door currently opens onto, which is pinned at the top of the list and shown as
    // the choice already made rather than as one more room to pick. "" if the door leads nowhere.
    initialDestinationRoomID: string;
    // Which door of that room the traveller is meant to arrive behind, by its label. "" for
    // "wherever that room's own way in is".
    initialDestinationDoorLabel: string;
    onChooseRoom: (roomID: string) => void;
    onSetDoorLabel: (label: string) => void;
}
