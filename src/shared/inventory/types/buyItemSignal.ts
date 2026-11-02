import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import { InventoryItemType } from "./inventoryItemType";

// A user asking to spend dollars on an item (see ServerInventoryManager.buyItem).
export default class BuyItemSignal extends EncodableData
{
    itemType: InventoryItemType;

    constructor(itemType: InventoryItemType)
    {
        super();
        this.itemType = itemType;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.itemType).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new BuyItemSignal((EncodableByteString.decode(bufferState) as EncodableByteString).str);
    }
}
