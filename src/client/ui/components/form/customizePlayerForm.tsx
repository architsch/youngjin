import { useEffect, useMemo, useState } from "react";
import Text from "../basic/text";
import IconButton from "../basic/iconButton";
import CloseIcon from "../basic/icons/closeIcon";
import ClientObjectManager from "../../../object/clientObjectManager";
import PopupUtil from "../../util/popupUtil";
import useMouseDragScroll from "../../util/mouseDragScroll";
import InstancedMeshCompositionPart from "../../../graphics/types/mesh/instancedMeshCompositionPart";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import FormColorInput from "../basic/formColorInput";
import FormRangeInput from "../basic/formRangeInput";

export default function CustomizePlayerForm()
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const [editCount, setEditCount] = useState(0);

    useEffect(() => {
        return () => {
            saveMyPlayerParts(); // Save upon exit
        };
    }, []);

    // Update 'parts' whenever 'editCount' changes.
    const parts = useMemo(() => getMyPlayerParts(), [editCount]);

    return <div className="absolute bottom-0 left-0 w-full z-40 flex flex-col pointer-events-none">
        <div className="m-2 p-2 flex flex-col gap-2 max-h-[30vh] bg-gray-700/90 rounded-lg pointer-events-auto">
            <div className="flex flex-row items-center gap-2">
                <Text content="Customize Character" size="sm"/>
                <IconButton icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup} additionalClassNames="ml-auto"/>
            </div>

            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full overflow-x-auto no-scrollbar">
                {parts.map((part, partIndex) =>
                    <div key={"player-part-" + partIndex} className="flex flex-row items-stretch gap-3 shrink-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className="flex flex-row items-center gap-2">
                                <Text content={`Part ${partIndex}`} size="sm"/>
                                <FormColorInput
                                    label="Color:"
                                    currValue={ColorUtil.rgbToHex(
                                        part.color!.x, part.color!.y, part.color!.z
                                    )}
                                    setColorHex={(colorHex: string) => {
                                        const rgb = ColorUtil.hexToRGB(colorHex);
                                        const newPart = {...part, color: {x: rgb[0], y: rgb[1], z: rgb[2]} };
                                        updateMyPlayerPart(partIndex, newPart);
                                        setEditCount(prev => prev + 1);
                                    }}
                                />
                                <FormRangeInput
                                    label="Height:"
                                    currValue={part.scale.y.toFixed(3)}
                                    min="0.75"
                                    max="1.25"
                                    step="0.001"
                                    setValue={(value: string) => {
                                        const newPart = {
                                            ...part,
                                            scale: {...part.scale, y: parseFloat(value)}
                                        };
                                        updateMyPlayerPart(partIndex, newPart);
                                        setEditCount(prev => prev + 1);
                                    }}
                                />
                            </div>
                        </div>
                        {partIndex < parts.length - 1 &&
                            <div className="w-px self-stretch bg-gray-500"/>}
                    </div>
                )}
            </div>
        </div>
    </div>;
}

// Reads the user's latest instanced-mesh composition from his/her own player object.
function getMyPlayerParts(): InstancedMeshCompositionPart[]
{
    return doForMyPlayer((c) => c.getParts());
}

function updateMyPlayerPart(partIndex: number, newPart: InstancedMeshCompositionPart)
{
    doForMyPlayer((c) => c.updatePartAtIndex(partIndex, newPart));
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