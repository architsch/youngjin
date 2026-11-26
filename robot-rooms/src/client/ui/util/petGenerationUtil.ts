import App from "../../app";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import ClientInventoryManager from "../../inventory/clientInventoryManager";
import ClientObjectManager from "../../object/clientObjectManager";
import SpeechBubble from "../../object/components/speechBubble";
import type PetGameObject from "../../object/types/gameObject/petGameObject";
import ObjectPlacementUtil from "../../object/util/objectPlacementUtil";
import PetDriverUtil from "../../object/util/petDriverUtil";
import StringUtil from "../../../shared/math/util/stringUtil";
import PetIdentityUtil, { PET_FIXED_ENERGIES, PET_FIXED_HEALTHS,
    PET_NAME_MAX_LENGTH } from "../../../shared/object/util/petIdentityUtil";
import PetZodiacUtil from "../../../shared/object/util/petZodiacUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { PET_PRICE_DOLLARS } from "../../../shared/system/sharedConstants";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import PopupUtil from "./popupUtil";

// The traits a pet's user sets as they generate it, in the order PetIdentityUtil.getTraitLevels gives them.
export const PET_TRAIT_NAMES = ["Dependence", "Sociability", "Aggressiveness", "Bravery", "Curiosity"];
// The healths an admin's pet can be kept at, as the form names them, in PET_FIXED_HEALTHS' order; and its charges, by
// the cells of its battery indicator each lights, in PET_FIXED_ENERGIES' order.
export const PET_FIXED_HEALTH_LABELS = PET_FIXED_HEALTHS.map(health => `${Math.round(100 * health)}%`);
export const PET_FIXED_ENERGY_LABELS = PET_FIXED_ENERGIES.map((_, i) => `Level ${i + 1}`);
// How long a guest's new pet asks them to sign in, standing idle meanwhile, in milliseconds.
export const PET_SIGN_IN_NOTICE_MS = 10_000;

// Generating a pet from the face the user has selected (see GeneratePetForm): they name it and set what it is like, pay
// for it, and it stands there.
const PetGenerationUtil =
{
    // Whether pets are offered where the user is: only in a room the server plays.
    isOffered: (): boolean =>
    {
        const room = App.getCurrentRoom();
        return room != undefined && room.roomType != RoomTypeEnumMap.SinglePlayer;
    },
    // Whether the user can generate one on the face: with the dollars it costs, room for it to stand, and room for
    // one more among their own (see PetObjectTypeConfig).
    canGenerate: (selection: VoxelQuadSelection): boolean =>
    {
        return PetGenerationUtil.isOffered() && ClientInventoryManager.getDollarsShown() >= PET_PRICE_DOLLARS
            && ObjectPlacementUtil.canAddPet(selection);
    },
    // Whether the user's pets stay with the room, at a health and a charge they pick that never change: an admin's do
    // (see ServerPetObjectTypeConfig).
    picksFixedNeeds: (): boolean =>
    {
        return ObjectPlacementUtil.generatesRoomPets();
    },
    open: (selection: VoxelQuadSelection): void =>
    {
        PopupUtil.openPopup({popupType: "generatePet", params: {selection}});
    },
    // A name as it is typed: on one line and no longer than a name may be, its spaces left for the words still to come.
    filterName: (typed: string): string =>
    {
        return StringUtil.truncateByCodePoints(typed.replace(/[\s\p{Cc}]+/gu, " ").trimStart(), PET_NAME_MAX_LENGTH);
    },
    // traitLevels: as PET_TRAIT_NAMES orders them. fixedHealthIndex and fixedEnergyIndex: which of PET_FIXED_HEALTHS and
    // PET_FIXED_ENERGIES, for a user who picks them. colorIndex: its body's, in PET_COLOR_PALETTE_NAME's palette. The
    // sign it is born under is drawn here, and shown to nobody.
    generate: async (selection: VoxelQuadSelection, name: string, traitLevels: number[], fixedHealthIndex: number,
        fixedEnergyIndex: number, colorIndex: number): Promise<void> =>
    {
        const [dependence, sociability, aggressiveness, bravery, curiosity] = traitLevels;
        const fixed = PetGenerationUtil.picksFixedNeeds();
        PopupUtil.closePopup();
        const objectId = await ObjectPlacementUtil.tryAddPet(selection, {name: PetIdentityUtil.sanitizeName(name),
            traits: {dependence, sociability, aggressiveness, bravery, curiosity, zodiac: PetZodiacUtil.pick()},
            fixedHealthLevel: fixed ? fixedHealthIndex + 1 : 0, fixedEnergyLevel: fixed ? fixedEnergyIndex + 1 : 0,
            colorIndex});
        if (objectId != undefined && App.getUser().userType == UserTypeEnumMap.Guest)
            askToSignIn(objectId);
    },
}

// A guest's pets are gone with their browser's cookie, so each one they generate asks them to sign in, in its own
// speech bubble, which nobody else sees; it stands idle meanwhile.
function askToSignIn(objectId: string): void
{
    const pet = ClientObjectManager.getObjectById(objectId) as PetGameObject | undefined;
    const speechBubble = pet?.components.speechBubble as SpeechBubble | undefined;
    if (pet == undefined || speechBubble == undefined)
        return;
    PetDriverUtil.hold(objectId, PET_SIGN_IN_NOTICE_MS);
    const ask = "Want to keep me?";
    speechBubble.showNotice(ask, "Sign In", () => PopupUtil.openPopup({popupType: "authPrompt"}), PET_SIGN_IN_NOTICE_MS);
    pet.sayAloud(ask);
}

export default PetGenerationUtil;
