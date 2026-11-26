import App from "../../app";
import ClientInventoryManager from "../../inventory/clientInventoryManager";
import SocketsClient from "../../networking/client/socketsClient";
import { dollarsSpentObservable } from "../../system/clientObservables";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InjectPetSignal from "../../../shared/object/types/injectPetSignal";
import { PetInjection } from "../../../shared/object/types/petInjection";
import PetInjectionUtil from "../../../shared/object/util/petInjectionUtil";

// A second press this soon after one is taken for the same press, in milliseconds.
const REPEAT_GUARD_MS = 400;
let injectedAt = -Infinity;

// Putting a battery or a wrench into the pet the user has selected (see PetEditOptions): the server does it, for what
// it costs, and tells the room (see PetServerUtil).
const PetInjectUtil =
{
    // Whether the user can put one into the pet now: it would be the better for it, and they have the dollars.
    canInject: (pet: AddObjectSignal, injection: PetInjection): boolean =>
    {
        return PetInjectionUtil.canInject(pet, injection)
            && ClientInventoryManager.getDollarsShown() >= PetInjectionUtil.getPrice(injection);
    },
    inject: (pet: AddObjectSignal, injection: PetInjection): void =>
    {
        const room = App.getCurrentRoom();
        const now = performance.now();
        if (room == undefined || now - injectedAt < REPEAT_GUARD_MS || !PetInjectUtil.canInject(pet, injection))
            return;
        injectedAt = now;
        SocketsClient.emitInjectPetSignal(new InjectPetSignal(room.id, pet.objectId, injection));
        // What it costs the server takes as it does it; the count shows it spent.
        dollarsSpentObservable.set(PetInjectionUtil.getPrice(injection));
    },
}

export default PetInjectUtil;
