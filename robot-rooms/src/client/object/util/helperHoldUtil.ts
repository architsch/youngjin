import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { gameModeObservable, objectSelectionObservable, roomChangedObservable } from "../../system/clientObservables";
import HoldObjectSignal from "../../../shared/object/types/holdObjectSignal";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import NpcGameObject from "../types/gameObject/npcGameObject";

// An admin's edit-mode selection of a helper holds it still for everyone, until the selection leaves it (see
// HelperAgentUtil): the server is told as the selection takes it and as it leaves it.
let held: {roomID: string, objectId: string} | undefined = undefined;

function refreshHold(): void
{
    const room = App.getCurrentRoom();
    const user = App.getUser();
    const objectId = objectSelectionObservable.peek()?.gameObject.params.objectId;
    const holding = (room != undefined && user != undefined && objectId != undefined
        && room.roomType != RoomTypeEnumMap.SinglePlayer && RoomValidationUtil.userIsAdmin(user)
        && NpcGameObject.isHeld(objectId)) ? {roomID: room.id, objectId} : undefined;
    if (holding?.roomID == held?.roomID && holding?.objectId == held?.objectId)
        return;
    if (held != undefined)
        SocketsClient.emitHoldObjectSignal(new HoldObjectSignal(held.roomID, held.objectId, false));
    if (holding != undefined)
        SocketsClient.emitHoldObjectSignal(new HoldObjectSignal(holding.roomID, holding.objectId, true));
    held = holding;
}

objectSelectionObservable.addListener("helperHoldUtil", refreshHold);
gameModeObservable.addListener("helperHoldUtil", refreshHold);
roomChangedObservable.addListener("helperHoldUtil", refreshHold);
