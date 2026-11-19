// What a user holds: how many of each kind of item (see InventoryItemTypeEnumMap). A kind they hold none of may be left out.
export type Inventory = {[itemType: string]: number};
