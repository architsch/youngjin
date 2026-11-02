import DollarBillFlight from "./dollarBillFlight";

// What is kept of a room's bills beside the room itself (see DollarBillUtil).
export default interface DollarBillRoomState
{
    // By object id.
    flights: Map<string, DollarBillFlight>;
    // When the next bill comes; undefined while the room holds as many as it may, or the wait is yet to start.
    nextSpawnAt: number | undefined;
}
