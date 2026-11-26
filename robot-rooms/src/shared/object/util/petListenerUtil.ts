import Vec3 from "../../math/types/vec3";
import Room from "../../room/types/room";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import AddObjectSignal from "../types/addObjectSignal";
import { PetActionEnumMap } from "../types/petAction";
import PetListener from "../types/petListener";
import PetListeners from "../types/petListeners";
import PetBehaviorUtil from "./petBehaviorUtil";
import PetBodyUtil from "./petBodyUtil";
import PetIdentityUtil from "./petIdentityUtil";
import PetOwnerUtil from "./petOwnerUtil";
import PetShownStateUtil from "./petShownStateUtil";

// A pet hears someone who speaks this near it, on its own floor (feet within this height of its own).
export const PET_HEARING_DISTANCE = 5;
const SAME_FLOOR_HEIGHT = 1;

const A = PetActionEnumMap;
// What a pet is too taken up with to hear anyone but by its name, which finds it wherever it is.
const DEAF_ACTIONS = [A.Sleep, A.Panic, A.Attack, A.Flee];

// Which of a room's pets a line someone says may be for (see HelperBehaviorUtil.pickListener, which picks among them
// and the room's helpers): read from the room as the server keeps it, and as each browser does, by what the pets show
// of themselves. One that is dead or out of battery hears nothing.
const PetListenerUtil =
{
    // speaker: where whoever says the line stands, at their middle.
    find: (room: Room, text: string, speaker: Vec3): PetListeners =>
    {
        const feet = VoxelPathUtil.feetOf(speaker);
        const listeners: PetListeners = {named: undefined, hearing: []};
        for (const objectId in room.objectById)
        {
            const pet = room.objectById[objectId];
            if (!PetOwnerUtil.isPet(pet))
                continue;
            const shown = PetShownStateUtil.getObjectState(pet);
            if (shown.action == A.Dead || shown.powerless)
                continue;
            const listener = toListener(pet);
            if (listener.name.length > 0 && PetBehaviorUtil.mentions(text, listener.name))
                listeners.named ??= listener;
            const {pos} = pet.transform;
            if (!DEAF_ACTIONS.includes(shown.action) && Math.hypot(pos.x - speaker.x, pos.z - speaker.z) <= PET_HEARING_DISTANCE
                && Math.abs(PetBodyUtil.getFeet(pos).y - feet.y) <= SAME_FLOOR_HEIGHT)
            {
                listeners.hearing.push(listener);
            }
        }
        return listeners;
    },
}

function toListener(pet: AddObjectSignal): PetListener
{
    return {objectId: pet.objectId, name: PetIdentityUtil.getObjectIdentity(pet).name, at: {...pet.transform.pos}};
}

export default PetListenerUtil;
