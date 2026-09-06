import { useCallback, useEffect, useState } from "react";
import RoomLightingUtil from "../../../../system/util/roomLightingUtil";
import RoomPrefs from "../../../../../shared/room/types/roomPrefs";
import { MAX_ROOM_PREFS_STEP } from "../../../../../shared/room/util/roomPrefsUtil";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import { roomPrefsChangedObservable } from "../../../../../shared/system/sharedObservables";
import Text from "../../basic/text";
import CompactIconButton from "../../input/compactIconButton";
import FormPaletteColorInput from "../../input/formPaletteColorInput";
import FormRangeInput from "../../input/formRangeInput";
import QuestionMarkIcon from "../../../svg/icons/questionMarkIcon";

// The "Lighting" section of a room's settings, shared by the two forms that offer it — a hub's,
// which an admin opens, and a room owner's own. What each setting means is in
// @docs/graphics/lighting.md .
//
// Every edit is applied to the scene as it is made and written down a couple of seconds later, so
// that a slider is dragged against the room itself rather than against a preview of it. There is no
// "apply" step and nothing to undo: what the user is looking at *is* the setting. Which of two
// simultaneous edits wins is not this component's business — see RoomLightingUtil.
export default function LightingSection({onToggleTooltip, roomID}: Props)
{
    const [prefs, setPrefs] = useState<RoomPrefs>(() => RoomLightingUtil.getPrefs());

    // Lighting another superuser changed shows up here without a reload. The observable only fires
    // for a change that was actually taken, so an edit of this client's own that is still on its
    // way to the server never gets dragged back to an older one.
    useEffect(() => {
        roomPrefsChangedObservable.addListener("lightingSection",
            () => setPrefs(RoomLightingUtil.getPrefs()));
        return () => roomPrefsChangedObservable.removeListener("lightingSection");
    }, []);

    const apply = useCallback((edit: (next: RoomPrefs) => void) => {
        const nextPrefs = {...prefs};
        edit(nextPrefs);
        RoomLightingUtil.applyLocalEdit(nextPrefs, roomID);
        setPrefs(nextPrefs);
    }, [prefs, roomID]);

    return <>
        <Text content="Lighting:" size="sm"/>

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={AMBIENT_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(AMBIENT_TOOLTIP_BUTTON_ID,
                        "The light that fills the whole room, reaching every surface no matter which way it faces.")}/>
                <Text content="Ambient Light" size="sm"/>
            </div>
            <FormPaletteColorInput
                label="Color"
                paletteName={LIGHT_COLOR_PALETTE_NAME}
                currValue={prefs.ambientColorIndex}
                setColorIndex={(index) => apply(next => next.ambientColorIndex = index)}
            />
            <FormRangeInput
                label="Strength"
                currValue={String(prefs.ambientIntensityStep)}
                setValue={(value) => apply(next => next.ambientIntensityStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={HEAD_LIGHT_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(HEAD_LIGHT_TOOLTIP_BUTTON_ID,
                        "The light every visitor carries with them. Turn it down in a room you have lit yourself, so that your own lights are what is seen.")}/>
                <Text content="Head Light" size="sm"/>
            </div>
            <FormPaletteColorInput
                label="Color"
                paletteName={LIGHT_COLOR_PALETTE_NAME}
                currValue={prefs.headLightColorIndex}
                setColorIndex={(index) => apply(next => next.headLightColorIndex = index)}
            />
            <FormRangeInput
                label="Power"
                currValue={String(prefs.headLightPowerStep)}
                setValue={(value) => apply(next => next.headLightPowerStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={FOG_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(FOG_TOOLTIP_BUTTON_ID,
                        "The air in the room. Things fade into it between where it starts and where it ends — and beyond the room, it is all there is.")}/>
                <Text content="Fog" size="sm"/>
            </div>
            <FormPaletteColorInput
                label="Color"
                paletteName={FOG_COLOR_PALETTE_NAME}
                currValue={prefs.fogColorIndex}
                setColorIndex={(index) => apply(next => next.fogColorIndex = index)}
            />
            <FormRangeInput
                label="Start"
                currValue={String(prefs.fogNearStep)}
                setValue={(value) => apply(next => next.fogNearStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="End"
                currValue={String(prefs.fogFarStep)}
                setValue={(value) => apply(next => next.fogFarStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>
    </>
}

export const AMBIENT_TOOLTIP_BUTTON_ID = "ambientLightTooltipButton";
export const HEAD_LIGHT_TOOLTIP_BUTTON_ID = "headLightTooltipButton";
export const FOG_TOOLTIP_BUTTON_ID = "fogTooltipButton";

// Every quantized setting here runs over the same range, since every one of them is a single stored
// character (see RoomPrefsUtil). An <input> wants its bounds as text.
const MAX_STEP_ATTRIBUTE = String(MAX_ROOM_PREFS_STEP);

interface Props
{
    // Raising this section's explanation, which the form owns so that only one is ever up at a time.
    onToggleTooltip: (targetElementId: string, text: string) => void;
    // Which room is being lit, named only when it is not the caller's own — which is to say, only by
    // an admin lighting a hub (see the room API).
    roomID?: string;
}
