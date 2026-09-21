// A hub the balancer is choosing between: what it knows about one without holding it in memory (see
// RoomPickerUtil, HubRoomUtil).
type HubRoomCandidate = {
    roomID: string,
    initialJoinPriority: number,
    population: number,
}

export default HubRoomCandidate;
