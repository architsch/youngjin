import { useMemo, useState } from "react";
import Text from "../basic/text";
import GameObject from "../../../object/types/gameObject/gameObject";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import PlayerCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import PlayerCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import StepperInput from "../input/stepperInput";
import PaletteColorInput from "../input/paletteColorInput";
import PartShapeIcon from "../../svg/icons/partShapeIcon";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits the PlayerCompositionParams of a character (the user's own, or an NPC) in place (type + color per part)
// and rebuilds its parts.

// builderName + selected type names the composition builder (also used for the preview icon).
const partSlots: {title: string, key: keyof PlayerCompositionParams["types"], builderName: string}[] = [
    {title: "Head", key: "head", builderName: "PlayerHead"},
    {title: "Ears", key: "ear", builderName: "PlayerEar"},
    {title: "Hat", key: "hat", builderName: "PlayerHat"},
    {title: "Torso", key: "torso", builderName: "PlayerTorso"},
    {title: "Arms", key: "arm", builderName: "PlayerArm"},
    {title: "Bottom", key: "bottom", builderName: "PlayerBottom"},
];

export default function CustomizePlayerPanel({ gameObject, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getParams(gameObject), [gameObject, editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params, since the composition may have been swapped by a reload (see
    // InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: PlayerCompositionParams) => void) => {
        const liveParams = getParams(gameObject);
        if (liveParams == undefined)
            return;
        trySave(gameObject);
        mutateParams(liveParams);
        getComposer(gameObject)?.rebuildParts();
        setEditCount(prev => prev + 1);
    };

    // Closable only where its owner says so (see ScrollPanel): the user's own character's goes away with the
    // selection or edit mode.
    return <ScrollPanel id="customizePlayerOptions" onClose={onClose}>
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

// Batches rapid edits into one save; an edit of another character first saves the one pending.
const trySave = createDeferredSave(
    (gameObject: GameObject) => {
        // (The character may have left the room meanwhile.)
        if (gameObject.spawnFinished && gameObject.obj.parent != null)
            getComposer(gameObject)?.saveParts();
    },
    (gameObject: GameObject) => gameObject);

function getComposer(gameObject: GameObject): InstancedMeshComposer | undefined
{
    return gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;
}

// The live params object, so edits apply directly.
function getParams(gameObject: GameObject): PlayerCompositionParams | undefined
{
    return getComposer(gameObject)?.getParams() as PlayerCompositionParams | undefined;
}

interface Props
{
    gameObject: GameObject;
    // Absent means it has no close button (see ScrollPanel).
    onClose?: () => void;
}
