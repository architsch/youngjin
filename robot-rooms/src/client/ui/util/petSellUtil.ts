import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import PlayModeSelectionUtil from "../../graphics/util/playModeSelectionUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import PetDriverUtil from "../../object/util/petDriverUtil";
import { objectSelectionObservable } from "../../system/clientObservables";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import PetNeedsUtil from "../../../shared/object/util/petNeedsUtil";
import PetSaleUtil from "../../../shared/object/util/petSaleUtil";
import ObjectEditUtil from "./objectEditUtil";
import PopupUtil from "./popupUtil";

// Selling the pet the user has selected (see PetEditOptions): removing it is the sale, for what it is worth in the
// health it is in, and no undo brings it back.
const PetSellUtil =
{
    // What the pet sells for now (see PetSaleUtil): by its health as this browser plays it, or, for one the server
    // plays, as the server last told.
    getPrice: (pet: AddObjectSignal): number =>
    {
        const needs = PetDriverUtil.getNeeds(pet.objectId)
            ?? PetNeedsUtil.decode(pet.metadata[ObjectMetadataKeyEnumMap.PetNeeds]?.str ?? "");
        return PetSaleUtil.getPrice(needs.health);
    },
    openConfirmPopup: (selection: ObjectSelection): void =>
    {
        const price = PetSellUtil.getPrice(selection.gameObject.params);
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: `Do you want to sell your pet with the price of $${price}? It will be gone forever!`,
                onConfirm: () => {
                    sell(selection);
                    PopupUtil.closePopup();
                },
                onCancel: PopupUtil.closePopup,
            },
        });
    },
}

function sell(selection: ObjectSelection): void
{
    // Re-checked: the pet may have died, or the room changed, while the confirmation popup was up. A selection that
    // only ended meanwhile (see PlayModeSelectionUtil) takes nothing back.
    const {objectId, transform} = selection.gameObject.params;
    if (ClientObjectManager.getObjectById(objectId) !== selection.gameObject || !ObjectEditUtil.canRemoveObject(selection))
        return;
    const at = {...transform.pos};
    const selectedInEditMode = objectSelectionObservable.peek() == selection;
    if (selectedInEditMode)
        ObjectSelection.unselect();
    PlayModeSelectionUtil.unselect();
    PetDriverUtil.sell(objectId);
    if (selectedInEditMode)
        VoxelQuadSelection.trySelectBestQuadNearby(at);
}

export default PetSellUtil;
