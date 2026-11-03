import BuyItemResultSignal from "../../../shared/inventory/types/buyItemResultSignal";
import BuyItemSignal from "../../../shared/inventory/types/buyItemSignal";
import PlayerShapeItemUtil from "../../../shared/inventory/util/playerShapeItemUtil";
import { PLAYER_SHAPE_PRICE_DOLLARS } from "../../../shared/system/sharedConstants";
import SocketsClient from "../../networking/client/socketsClient";
import { connectionStateObservable, dollarsSpentObservable, inventoryObservable, notificationMessageObservable,
    pendingPurchaseElementObservable } from "../../system/clientObservables";
import RefusalCoachMarkUtil from "../../ui/util/refusalCoachMarkUtil";
import ScreenInputBlockUtil from "../../ui/util/screenInputBlockUtil";
import ClientInventoryManager from "../clientInventoryManager";

// Past this an answer isn't coming, the connection having gone, and the user may ask again, which pays for nothing twice
// (see ServerInventoryManager.buyItem).
export const ANSWER_TIMEOUT_MS = 5000;
const TOO_FEW_DOLLARS_MESSAGE = `You need $${PLAYER_SHAPE_PRICE_DOLLARS}\nto unlock this.`;
const CONNECTION_LISTENER_KEY = "playerShapeUnlockUtil";

const asked: {[itemType: string]: {elementId: string, onUnlocked: () => void, time: number}} = {};
// The purchase the screen waits on the answer to.
let waiting: {itemType: string, since: number, endHold: () => void, timeout: ReturnType<typeof setTimeout>} | undefined
    = undefined;

// Buying a locked shape for the user's character. Only the server's answer unlocks one, so that nothing shows as spent or
// unlocked that wasn't. Until it comes, or can't, what was clicked shows the wait and the screen takes no input, so that
// nothing the answer is for can change meanwhile.
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
        // Its timer may come late, held back with the page out of sight.
        if (waiting != undefined && now - waiting.since >= ANSWER_TIMEOUT_MS)
            stopWaiting();
        if (waiting != undefined || (asked[itemType] != undefined && now - asked[itemType].time < ANSWER_TIMEOUT_MS))
            return;
        if (!canAfford())
        {
            RefusalCoachMarkUtil.show(elementId, TOO_FEW_DOLLARS_MESSAGE);
            return;
        }
        asked[itemType] = {elementId, onUnlocked, time: now};
        startWaiting(itemType, elementId);
        SocketsClient.emitBuyItemSignal(new BuyItemSignal(itemType));
    },
    // After what the user holds now (see ServerInventoryManager.buyItem).
    onBuyItemResultSignalReceived: (signal: BuyItemResultSignal): void =>
    {
        const ask = asked[signal.itemType];
        if (ask == undefined)
            return;
        delete asked[signal.itemType];
        stopWaiting(signal.itemType);
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

// Until the answer, the timeout or a change of connection, which takes its answers with it.
function startWaiting(itemType: string, elementId: string): void
{
    waiting = {itemType, since: Date.now(), endHold: ScreenInputBlockUtil.hold(),
        timeout: setTimeout(() => stopWaiting(itemType), ANSWER_TIMEOUT_MS)};
    pendingPurchaseElementObservable.set(elementId);
    connectionStateObservable.addListener(CONNECTION_LISTENER_KEY, () => stopWaiting());
}

// Ends the wait on that purchase, or on whichever it is.
function stopWaiting(itemType?: string): void
{
    if (waiting == undefined || (itemType != undefined && waiting.itemType != itemType))
        return;
    clearTimeout(waiting.timeout);
    waiting.endHold();
    waiting = undefined;
    pendingPurchaseElementObservable.set(null);
    connectionStateObservable.removeListener(CONNECTION_LISTENER_KEY);
}

export default PlayerShapeUnlockUtil;
