import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableMap from "../../networking/types/encodableMap";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";
import { Inventory } from "./inventory";

// All a user holds, as the server tells them when they connect and whenever it changes.
export default class InventorySignal extends EncodableData
{
    inventory: Inventory;

    constructor(inventory: Inventory)
    {
        super();
        this.inventory = inventory;
    }

    encode(bufferState: BufferState)
    {
        const quantities: Record<string, EncodableData> = {};
        for (const [itemType, quantity] of Object.entries(this.inventory))
            quantities[itemType] = new EncodableRaw4ByteNumber(quantity);
        new EncodableMap(quantities, "string").encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quantities = (EncodableMap.decodeWithParams(bufferState, EncodableRaw4ByteNumber.decode,
            "string") as EncodableMap).map;
        const inventory: Inventory = {};
        for (const [itemType, quantity] of Object.entries(quantities))
            inventory[itemType] = (quantity as EncodableRaw4ByteNumber).n;
        return new InventorySignal(inventory);
    }
}
