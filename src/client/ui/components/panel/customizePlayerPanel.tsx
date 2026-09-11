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

//------------------------------------------------------------------------
// This panel edits the player's composition by directly manipulating its
// PlayerCompositionParams object: each body part has a type (which selects
// the part's shape variant) and a color. After every edit, the player's
// parts are rebuilt from the params, which keeps every derived placement
// consistent automatically.
//------------------------------------------------------------------------

// 'builderName' joins with the slot's selected type to name the composition builder
// that shape belongs to, which is both what assembles the part and what the stepper's
// preview icon is drawn from.
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

    // The edit is written to the params the player is composed of at this moment, rather than to
    // the ones this render read. Nothing re-renders this panel when the composition is reloaded from
    // the object's metadata, so the two are only the same object for as long as nobody has swapped
    // it (see InstancedMeshComposition), and an edit written to a params object the player is no
    // longer composed of is an edit the user never made.
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

    // This panel is what the user's own character being selected looks like, so it neither moves the
    // camera nor can be put away on its own: the selection frames the character (see
    // WorldSpaceSelectionUtil), and what takes the panel away is the selection moving on — or edit
    // mode itself ending, by the game-mode switch or the back gesture.
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

// Dressing a character is a run of small edits, each of which rewrites the whole composition, so
// they are written down together rather than one at a time.
const trySave = createDeferredSave(() => saveMyPlayerParts());

// Reads the user's own player object's composition params (the live object,
// so that edits can be applied to it directly).
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
