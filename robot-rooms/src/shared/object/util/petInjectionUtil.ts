import { PET_BATTERY_PRICE_DOLLARS, PET_WRENCH_PRICE_DOLLARS } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import { PetActionEnumMap } from "../types/petAction";
import { PetInjection, PetInjectionEnumMap } from "../types/petInjection";
import PetIdentityUtil from "./petIdentityUtil";
import PetOwnerUtil from "./petOwnerUtil";
import PetShownStateUtil, { PET_BATTERY_LEVELS } from "./petShownStateUtil";

// Putting a battery or a wrench into a pet, which anyone in its room may do, for dollars (see InjectPetSignal): a
// battery charges it in full, and a wrench mends a share of its health (see PetBehaviorUtil.inject).
const PetInjectionUtil =
{
    isInjection: (injection: number): boolean =>
    {
        return Object.values(PetInjectionEnumMap).includes(injection);
    },
    getPrice: (injection: PetInjection): number =>
    {
        return (injection == PetInjectionEnumMap.Battery) ? PET_BATTERY_PRICE_DOLLARS : PET_WRENCH_PRICE_DOLLARS;
    },
    // Whether a battery is ever of use to a pet: not to one whose charge is kept where it is (see PetIdentity).
    takesBattery: (pet: AddObjectSignal): boolean =>
    {
        return PetIdentityUtil.getFixedEnergy(PetIdentityUtil.getObjectIdentity(pet)) == undefined;
    },
    // Likewise a wrench: not to one whose health is kept where it is.
    takesWrench: (pet: AddObjectSignal): boolean =>
    {
        return PetIdentityUtil.getFixedHealth(PetIdentityUtil.getObjectIdentity(pet)) == undefined;
    },
    // Whether a living pet would be the better for one now, judged by what it shows of itself, which everyone in its
    // room and the server see alike: a battery while not every cell of its indicator is lit, and a wrench while it shows
    // any rust.
    canInject: (pet: AddObjectSignal | undefined, injection: PetInjection): boolean =>
    {
        if (pet == undefined || !PetOwnerUtil.isPet(pet))
            return false;
        const shown = PetShownStateUtil.getObjectState(pet);
        if (shown.action == PetActionEnumMap.Dead)
            return false;
        return (injection == PetInjectionEnumMap.Battery)
            ? PetInjectionUtil.takesBattery(pet) && shown.batteryLevel < PET_BATTERY_LEVELS
            : PetInjectionUtil.takesWrench(pet) && shown.rust > 0;
    },
}

export default PetInjectionUtil;
