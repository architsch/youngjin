import PlayerCompositionConstants, { NUM_FREE_PLAYER_PART_TYPES } from "../../graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import { PLAYER_SHAPE_PRICE_DOLLARS } from "../../system/sharedConstants";
import { Inventory } from "../types/inventory";
import { InventoryItemType } from "../types/inventoryItemType";

// The shapes of a character's parts that have to be bought. One is an item once bought, held beside the dollars it cost,
// which is what lets the row take both in a single write (see DBInventoryUtil.buyItem).
const PlayerShapeItemUtil =
{
    // By its part's name and its builder's number (PlayerHead_3). Stored, so never changed, and without a dot, which
    // Firestore would read as a path.
    getItemType: (part: string, shape: number): InventoryItemType =>
    {
        return `shape_${part}_${shape}`;
    },
    isLocked: (inventory: Inventory, part: string, shape: number): boolean =>
    {
        return shape >= NUM_FREE_PLAYER_PART_TYPES && !(inventory[PlayerShapeItemUtil.getItemType(part, shape)] > 0);
    },
    // Undefined for what isn't for sale.
    getPrice: (itemType: InventoryItemType): number | undefined =>
    {
        return itemTypesForSale.has(itemType) ? PLAYER_SHAPE_PRICE_DOLLARS : undefined;
    },
}

const itemTypesForSale = new Set(Object.entries(PlayerCompositionConstants.numTypes).flatMap(([part, numTypes]) =>
    Array.from({length: numTypes - NUM_FREE_PLAYER_PART_TYPES}, (_, index) =>
        PlayerShapeItemUtil.getItemType(part, NUM_FREE_PLAYER_PART_TYPES + index))));

export default PlayerShapeItemUtil;
