import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import { InventoryItemType } from "./inventoryItemType";

// How a user's asking to buy an item ended: whether they hold it now, as what they were last told they hold says.
export default class BuyItemResultSignal extends EncodableData
{
    itemType: InventoryItemType;
    bought: boolean;

    constructor(itemType: InventoryItemType, bought: boolean)
    {
        super();
        this.itemType = itemType;
        this.bought = bought;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.itemType).encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.bought ? 1 : 0;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const itemType = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new BuyItemResultSignal(itemType, bufferState.view[bufferState.byteIndex++] === 1);
    }
}
