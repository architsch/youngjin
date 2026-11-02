import BuyItemResultSignal from "../../../shared/inventory/types/buyItemResultSignal";
import BuyItemSignal from "../../../shared/inventory/types/buyItemSignal";
import PlayerShapeItemUtil from "../../../shared/inventory/util/playerShapeItemUtil";
import { PLAYER_SHAPE_PRICE_DOLLARS } from "../../../shared/system/sharedConstants";
import SocketsClient from "../../networking/client/socketsClient";
import { dollarsSpentObservable, inventoryObservable, notificationMessageObservable } from "../../system/clientObservables";
import RefusalCoachMarkUtil from "../../ui/util/refusalCoachMarkUtil";
import ClientInventoryManager from "../clientInventoryManager";

// Past this an answer isn't coming, the connection having gone, and the user may ask again, which pays for nothing twice
// (see ServerInventoryManager.buyItem).
const ANSWER_TIMEOUT_MS = 5000;
const TOO_FEW_DOLLARS_MESSAGE = `You need $${PLAYER_SHAPE_PRICE_DOLLARS}\nto unlock this.`;

const asked: {[itemType: string]: {elementId: string, onUnlocked: () => void, time: number}} = {};

// Buying a locked shape for the user's character. Only the server's answer unlocks one, so that nothing shows as spent or
// unlocked that wasn't.
const PlayerShapeUnlockUtil =
{
    isLocked: (part: string, shape: number): boolean =>
    {
        return PlayerShapeItemUtil.isLocked(inventoryObservable.peek(), part, shape);
    },
    // elementId: what was clicked, over which a shortage of dollars is told. onUnlocked runs once the dollars are spent and
    // the shape is the user's.
    unlock: (part: string, shape: number, elementId: string, onUnlocked: () => void): void =>
    {
        const itemType = PlayerShapeItemUtil.getItemType(part, shape);
        const now = Date.now();
        if (asked[itemType] != undefined && now - asked[itemType].time < ANSWER_TIMEOUT_MS)
            return;
        if (!canAfford())
        {
            RefusalCoachMarkUtil.show(elementId, TOO_FEW_DOLLARS_MESSAGE);
            return;
        }
        asked[itemType] = {elementId, onUnlocked, time: now};
        SocketsClient.emitBuyItemSignal(new BuyItemSignal(itemType));
    },
    // After what the user holds now (see ServerInventoryManager.buyItem).
    onBuyItemResultSignalReceived: (signal: BuyItemResultSignal): void =>
    {
        const ask = asked[signal.itemType];
        if (ask == undefined)
            return;
        delete asked[signal.itemType];
        if (!signal.bought)
        {
            if (canAfford())
                notificationMessageObservable.set("That couldn't be unlocked, and no dollars were spent. Try again.");
            else
                RefusalCoachMarkUtil.show(ask.elementId, TOO_FEW_DOLLARS_MESSAGE);
            return;
        }
        dollarsSpentObservable.set(PLAYER_SHAPE_PRICE_DOLLARS);
        ask.onUnlocked();
    },
}

function canAfford(): boolean
{
    return ClientInventoryManager.getDollarsShown() >= PLAYER_SHAPE_PRICE_DOLLARS;
}

export default PlayerShapeUnlockUtil;
