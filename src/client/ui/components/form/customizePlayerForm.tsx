import { useEffect, useMemo, useState } from "react";
import Text from "../basic/text";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import ClientObjectManager from "../../../object/clientObjectManager";
import PopupUtil from "../../util/popupUtil";
import useMouseDragScroll from "../../util/mouseDragScroll";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import PlayerCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import { cameraModeObservable, clientFeatureFlagsObservable } from "../../../system/clientObservables";
import PlayerCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import WorldSpaceSelectionUtil from "../../../graphics/util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import StepperInput from "../input/stepperInput";
import Base94ColorInput from "../input/base94ColorInput";

//------------------------------------------------------------------------
// This form edits the player's composition by directly manipulating its
// PlayerCompositionParams object: each body part has a type (which selects
// the part's shape variant) and a color. After every edit, the player's
// parts are rebuilt from the params, which keeps every derived placement
// consistent automatically.
//------------------------------------------------------------------------

const partSlots: {title: string, key: keyof PlayerCompositionParams["types"]}[] = [
    {title: "Head", key: "head"},
    {title: "Ears", key: "ear"},
    {title: "Hat", key: "hat"},
    {title: "Torso", key: "torso"},
    {title: "Arms", key: "arm"},
    {title: "Bottom", key: "bottom"},
];

export default function CustomizePlayerForm()
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const [editCount, setEditCount] = useState(0);

    useEffect(() => {
        cameraModeObservable.set("selfView");
        WorldSpaceSelectionUtil.unselectAll();
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableAllSelectionChange);
        return () => {
            cameraModeObservable.set("firstPerson");
            clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableAllSelectionChange);
        };
    }, []);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getMyPlayerParams(), [editCount]);
    if (params == undefined)
        return null;

    const applyEdit = (mutateParams: () => void) => {
        trySave();
        mutateParams();
        rebuildMyPlayerParts();
        setEditCount(prev => prev + 1);
    };

    return <div className="absolute bottom-0 left-0 w-full z-40 flex flex-col pointer-events-none">
        <div className="relative m-2 p-2 flex flex-col gap-2 max-h-[30vh] bg-gray-700 rounded-lg pointer-events-auto">
            <IconButton icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup}
                additionalClassNames="absolute right-0 bottom-full mb-1"/>

            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full overflow-x-auto no-scrollbar">
                {partSlots.map((slot, slotIndex) =>
                    <div key={"part-slot-" + slot.key} className="flex flex-row items-stretch gap-3 shrink-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className="flex flex-row items-center gap-1 shrink-0">
                                <Text content={slot.title} size="sm"/>
                                <Base94ColorInput
                                    currValue={ColorUtil.rgbToBase94Index(params.colors[slot.key])}
                                    setColorIndex={(index: number) => applyEdit(() => params.colors[slot.key] = ColorUtil.base94IndexToRGB(index))}
                                />
                            </div>
                            <StepperInput
                                currValue={params.types[slot.key]}
                                numValues={PlayerCompositionConstants.numTypes[slot.key]}
                                setValue={(value: number) => applyEdit(() => params.types[slot.key] = value)}
                            />
                        </div>
                        {slotIndex < partSlots.length - 1 &&
                            <div className="w-px self-stretch bg-gray-500"/>}
                    </div>
                )}
            </div>
        </div>
    </div>;
}

let saveMyPlayerPartsTimeout: ReturnType<typeof setTimeout> | undefined;
function trySave()
{
    if (!saveMyPlayerPartsTimeout)
    {
        // Prevent parameter changes from triggering the save-operation too often.
        // One save per 2-second interval is enough.
        saveMyPlayerPartsTimeout = setTimeout(() => {
            saveMyPlayerParts();
            saveMyPlayerPartsTimeout = undefined;
        }, 2000);
    }
}

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
        console.error(`CustomizePlayerForm :: My player not found`);
        return;
    }
    const instancedMeshComposer = myPlayer.components.instancedMeshComposer as InstancedMeshComposer;
    return action(instancedMeshComposer);
}
