import { useMemo, useState } from "react";
import Text from "../basic/text";
import IconButton from "../basic/iconButton";
import CloseIcon from "../basic/icons/closeIcon";
import ClientObjectManager from "../../../object/clientObjectManager";
import PopupUtil from "../../util/popupUtil";
import useMouseDragScroll from "../../util/mouseDragScroll";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import StringUtil from "../../../../shared/math/util/stringUtil";
import FormBase94ColorInput from "../basic/formBase94ColorInput";
import FormRangeInput from "../basic/formRangeInput";

//------------------------------------------------------------------------
// This form edits the player's composition through its encoded-parameters form:
// each control reads/writes a single character (i.e. a single quantized parameter)
// of the encoded string, and decoding the edited string rebuilds all the parts,
// which keeps every derived placement (neck, arms, eyes) consistent automatically.
// "charIndex" refers to the position of the parameter's character within the string,
// mirroring the parameter order defined in PlayerCompositionCodec.
//------------------------------------------------------------------------

const paramGroups: {title: string, params: {charIndex: number, label: string, isColor?: boolean}[]}[] = [
    {title: "Head", params: [
        {charIndex: 0, label: "Top:"},
        {charIndex: 4, label: "Width:"},
        {charIndex: 9, label: "Color:", isColor: true},
    ]},
    {title: "Neck", params: [
        {charIndex: 1, label: "Height:"},
    ]},
    {title: "Torso", params: [
        {charIndex: 2, label: "Bottom:"},
        {charIndex: 5, label: "Width:"},
        {charIndex: 10, label: "Color:", isColor: true},
    ]},
    {title: "Arms", params: [
        {charIndex: 3, label: "Length:"},
        {charIndex: 6, label: "Width:"},
        {charIndex: 11, label: "Color:", isColor: true},
    ]},
    {title: "Eyes", params: [
        {charIndex: 7, label: "Pupil Size:"},
        {charIndex: 12, label: "Pupil Color:", isColor: true},
        {charIndex: 8, label: "Iris Size:"},
        {charIndex: 13, label: "Iris Color:", isColor: true},
    ]},
];

// Each slider spans the full quantization range of a single encoded character
// (see StringUtil's visible-ASCII encoding scheme).
const RAW_PARAM_MIN = "0";
const RAW_PARAM_MAX = "93";

let saveMyPlayerPartsTimeout: NodeJS.Timeout | undefined;

export default function CustomizePlayerForm()
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const [editCount, setEditCount] = useState(0);

    // Update 'encodedParams' whenever 'editCount' changes.
    const encodedParams = useMemo(() => getMyPlayerEncodedParams(), [editCount]);
    if (encodedParams == undefined)
        return null;

    const applyParam = (charIndex: number, rawValue: number) => {
        if (!saveMyPlayerPartsTimeout)
        {
            // Prevent parameter changes from triggering the save-operation too often.
            // One save per 2-second interval is enough.
            saveMyPlayerPartsTimeout = setTimeout(() => {
                saveMyPlayerParts();
                saveMyPlayerPartsTimeout = undefined;
            }, 2000);
        }
        const newChar = StringUtil.convertRawNumberToVisibleASCII(rawValue);
        setMyPlayerEncodedParams(encodedParams.substring(0, charIndex)
            + newChar + encodedParams.substring(charIndex + 1));
        setEditCount(prev => prev + 1);
    };

    return <div className="absolute bottom-0 left-0 w-full z-40 flex flex-col pointer-events-none">
        <div className="m-2 p-2 flex flex-col gap-2 max-h-[30vh] bg-gray-700/90 rounded-lg pointer-events-auto">
            <div className="flex flex-row items-center gap-2">
                <Text content="Customize Character" size="sm"/>
                <IconButton icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup} additionalClassNames="ml-auto"/>
            </div>

            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full overflow-x-auto no-scrollbar">
                {paramGroups.map((group, groupIndex) =>
                    <div key={"param-group-" + groupIndex} className="flex flex-row items-stretch gap-3 shrink-0">
                        <div className="flex flex-col items-start gap-1 shrink-0">
                            <Text content={group.title} size="sm"/>
                            {group.params.map((param) =>
                                param.isColor
                                    ? <FormBase94ColorInput
                                        key={"param-" + param.charIndex}
                                        label={param.label}
                                        currValue={StringUtil.convertVisibleASCIIToRawNumber(encodedParams, param.charIndex)}
                                        setColorIndex={(index: number) => applyParam(param.charIndex, index)}
                                    />
                                    : <FormRangeInput
                                        key={"param-" + param.charIndex}
                                        label={param.label}
                                        currValue={StringUtil.convertVisibleASCIIToRawNumber(encodedParams, param.charIndex).toString()}
                                        min={RAW_PARAM_MIN}
                                        max={RAW_PARAM_MAX}
                                        step="1"
                                        setValue={(value: string) => applyParam(param.charIndex, parseInt(value))}
                                    />
                            )}
                        </div>
                        {groupIndex < paramGroups.length - 1 &&
                            <div className="w-px self-stretch bg-gray-500"/>}
                    </div>
                )}
            </div>
        </div>
    </div>;
}

// Reads the user's latest instanced-mesh composition from his/her own player object,
// in its encoded-parameters form (one character per parameter).
function getMyPlayerEncodedParams(): string | undefined
{
    return doForMyPlayer((c) => c.encodeParts());
}

// Rebuilds the player's composition from the given encoded parameters.
function setMyPlayerEncodedParams(encodedParams: string)
{
    doForMyPlayer((c) => c.decodeParts(encodedParams));
}

function saveMyPlayerParts()
{
    console.log("saveMyPlayerParts called");
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
