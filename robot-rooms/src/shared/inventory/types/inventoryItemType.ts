export type InventoryItemType = string;

// The kinds of item a user can hold, beside the shapes they buy (see PlayerShapeItemUtil). Each value is a key of the
// stored inventory (see DBUser), so it is never renamed.
export const InventoryItemTypeEnumMap: Record<string, InventoryItemType> =
{
    Dollar: "dollar",
}
