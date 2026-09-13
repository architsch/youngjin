import { useMemo, useState } from "react";
import Text from "../basic/text";
import ClientObjectManager from "../../../object/clientObjectManager";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import PlayerCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import PlayerCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import StepperInput from "../input/stepperInput";
import PaletteColorInput from "../input/paletteColorInput";
import PartShapeIcon from "../../svg/icons/partShapeIcon";
import ClientEventHistoryUtil from "../../../system/util/clientEventHistoryUtil";
import ClientEvent from "../../../system/types/clientEvent";
import { ClientEventType } from "../../../system/types/clientEventType";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits the player's PlayerCompositionParams in place (type + color per part) and rebuilds the parts.

// builderName + selected type names the composition builder (also used for the preview icon).
const partSlots: {title: string, key: keyof PlayerCompositionParams["types"], builderName: string}[] = [
    {title: "Head", key: "head", builderName: "PlayerHead"},
    {title: "Ears", key: "ear", builderName: "PlayerEar"},
    {title: "Hat", key: "hat", builderName: "PlayerHat"},
    {title: "Torso", key: "torso", builderName: "PlayerTorso"},
    {title: "Arms", key: "arm", builderName: "PlayerArm"},
    {title: "Bottom", key: "bottom", builderName: "PlayerBottom"},
];

export default function CustomizePlayerPanel()
{
    const [editCount, setEditCount] = useState(0);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getMyPlayerParams(), [editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params, since the composition may have been swapped by a reload (see
    // InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: PlayerCompositionParams) => void) => {
        const liveParams = getMyPlayerParams();
        if (liveParams == undefined)
            return;
        trySave();
        mutateParams(liveParams);
        rebuildMyPlayerParts();
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyChangedPlayerPart));
        setEditCount(prev => prev + 1);
    };

    // Not closable: it is the character selection's panel and goes away with the selection or edit mode.
    return <ScrollPanel id="customizePlayerOptions">
        {partSlots.map((slot, slotIndex) =>
            <div key={"part-slot-" + slot.key} className="flex flex-row items-stretch gap-3 shrink-0">
                <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="flex flex-row items-center gap-1 shrink-0">
                        <Text content={slot.title} size="sm"/>
                        <PaletteColorInput
                            paletteName="Player"
                            currValue={ColorUtil.rgbToPaletteIndex("Player", params.colors[slot.key])}
                            setColorIndex={(index: number) => applyEdit(
                                (p) => p.colors[slot.key] = ColorUtil.paletteIndexToRGB("Player", index))}
                        />
                    </div>
                    <StepperInput
                        currValue={params.types[slot.key]}
                        numValues={PlayerCompositionConstants.numTypes[slot.key]}
                        setValue={(value: number) => applyEdit((p) => p.types[slot.key] = value)}
                        preview={<PartShapeIcon params={params}
                            builderType={`${slot.builderName}_${params.types[slot.key]}`}/>}
                    />
                </div>
                {slotIndex < partSlots.length - 1 &&
                    <div className="w-px self-stretch bg-gray-500"/>}
            </div>
        )}
    </ScrollPanel>;
}

// Batches rapid edits into one save.
const trySave = createDeferredSave(() => saveMyPlayerParts());

// The live params object, so edits apply directly.
function getMyPlayerParams(): PlayerCompositionParams | undefined
{
    return doForMyPlayer((c) => c.getParams());
}

// Rebuilds the player's parts from its current composition params.
function rebuildMyPlayerParts()
{
    doForMyPlayer((c) => c.rebuildParts());
}

function saveMyPlayerParts()
{
    doForMyPlayer((c) => c.saveParts());
}

function doForMyPlayer(action: (composer: InstancedMeshComposer) => any)
{
    const myPlayer = ClientObjectManager.getMyPlayer();
    if (!myPlayer)
    {
        console.error(`CustomizePlayerPanel :: My player not found`);
        return;
    }
    const instancedMeshComposer = myPlayer.components.instancedMeshComposer as InstancedMeshComposer;
    return action(instancedMeshComposer);
}
