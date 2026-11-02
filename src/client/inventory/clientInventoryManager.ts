import { InventoryItemTypeEnumMap } from "../../shared/inventory/types/inventoryItemType";
import InventorySignal from "../../shared/inventory/types/inventorySignal";
import { dollarsInFlightObservable, inventoryGainObservable, inventoryObservable } from "../system/clientObservables";

// What the user holds, which only the server changes (see ServerInventoryManager). The count on the screen follows the
// bill the user sees collected, which flies to it (see DollarBillGameObject.onCollected): a dollar isn't shown until its
// bill arrives, however soon the server has counted it.
const ClientInventoryManager =
{
    onInventorySignalReceived: (signal: InventorySignal): void =>
    {
        inventoryObservable.set(signal.inventory);
    },
    getDollarsShown: (): number =>
    {
        const dollars = inventoryObservable.peek()[InventoryItemTypeEnumMap.Dollar] ?? 0;
        return Math.max(0, dollars - dollarsInFlightObservable.peek());
    },
    onDollarTakingOff: (): void =>
    {
        dollarsInFlightObservable.change(numInFlight => numInFlight + 1);
    },
    onDollarArrived: (): void =>
    {
        dollarsInFlightObservable.change(numInFlight => numInFlight - 1);
        inventoryGainObservable.set(InventoryItemTypeEnumMap.Dollar);
    },
    // Dollars the count waits to show for another reason, as it does for a bill in flight (see LoginRewardUtil).
    holdBackDollars: (dollars: number): void =>
    {
        dollarsInFlightObservable.change(numHeldBack => numHeldBack + dollars);
    },
    releaseDollars: (dollars: number): void =>
    {
        dollarsInFlightObservable.change(numHeldBack => numHeldBack - dollars);
    },
}

export default ClientInventoryManager;
