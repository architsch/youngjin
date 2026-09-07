import { useCallback, useEffect, useState } from "react";
import RoomLightingUtil from "../../../../graphics/light/util/roomLightingUtil";
import RoomPrefs from "../../../../../shared/room/types/roomPrefs";
import { MAX_ROOM_PREFS_STEP } from "../../../../../shared/room/util/roomPrefsUtil";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME,
    SCENERY_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
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
                        "The light every visitor carries with them. Power is how much of it there is — turn it down in a room you have lit yourself, so that your own lights are what is seen. Range is how far it reaches and how sharply it fades on the way, which is the difference between a pool around your feet and a wash that fills the room.")}/>
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
            <FormRangeInput
                label="Range"
                currValue={String(prefs.headLightRangeStep)}
                setValue={(value) => apply(next => next.headLightRangeStep = Number(value))}
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

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={SMOKE_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(SMOKE_TOOLTIP_BUTTON_ID,
                        "The air in your room, unevenly thick rather than an even wash. Where the smoke gathers the fog thins and the room shows through, so Strength is how far it clears — at nothing the air is even again. Drift and Rise are which way it goes: level for dry ice pouring across a floor, climbing for smoke coming off something.")}/>
                <Text content="Smoke" size="sm"/>
            </div>
            <FormRangeInput
                label="Strength"
                currValue={String(prefs.fogSmokeAmplitudeStep)}
                setValue={(value) => apply(next => next.fogSmokeAmplitudeStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Scale"
                currValue={String(prefs.fogSmokeScaleStep)}
                setValue={(value) => apply(next => next.fogSmokeScaleStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Speed"
                currValue={String(prefs.fogSmokeSpeedStep)}
                setValue={(value) => apply(next => next.fogSmokeSpeedStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Drift"
                currValue={String(prefs.fogSmokeDriftStep)}
                setValue={(value) => apply(next => next.fogSmokeDriftStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Rise"
                currValue={String(prefs.fogSmokeRiseStep)}
                setValue={(value) => apply(next => next.fogSmokeRiseStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={CLOUDS_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(CLOUDS_TOOLTIP_BUTTON_ID,
                        "Drifting cloud in the sky past your room — the air outside it, where the Smoke above is the air inside. Strength is how much weather there is at all, and starts at none. The clouds are painted in their own color and the sky between them in the fog's, so the further apart you pick the two the stronger they read. Softness is how sharp the edge of a cloud is, from cut to no edge at all.")}/>
                <Text content="Clouds" size="sm"/>
            </div>
            <FormPaletteColorInput
                label="Color"
                paletteName={SCENERY_COLOR_PALETTE_NAME}
                currValue={prefs.cloudColorIndex}
                setColorIndex={(index) => apply(next => next.cloudColorIndex = index)}
            />
            <FormRangeInput
                label="Strength"
                currValue={String(prefs.cloudOpacityStep)}
                setValue={(value) => apply(next => next.cloudOpacityStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Scale"
                currValue={String(prefs.cloudScaleStep)}
                setValue={(value) => apply(next => next.cloudScaleStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Softness"
                currValue={String(prefs.cloudSoftnessStep)}
                setValue={(value) => apply(next => next.cloudSoftnessStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Speed"
                currValue={String(prefs.cloudSpeedStep)}
                setValue={(value) => apply(next => next.cloudSpeedStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-md bg-black/25 yj-surface-convex">
            <div className="flex flex-row items-center">
                <CompactIconButton id={GROUND_TOOLTIP_BUTTON_ID} icon={<QuestionMarkIcon/>} size="md"
                    onClick={() => onToggleTooltip(GROUND_TOOLTIP_BUTTON_ID,
                        "The country your room stands over, seen below the horizon. Low ground is painted in the first color and high ground in the second, so how far apart you pick the two is how mountainous it reads, and Softness is how sharply they meet — a drawn coastline at one end, a long hillside at the other. It fades into the air with distance as land does; Opacity is how long it takes to go.")}/>
                <Text content="Ground" size="sm"/>
            </div>
            <FormPaletteColorInput
                label="Color"
                paletteName={SCENERY_COLOR_PALETTE_NAME}
                currValue={prefs.groundColorIndex}
                setColorIndex={(index) => apply(next => next.groundColorIndex = index)}
            />
            <FormPaletteColorInput
                label="Peaks"
                paletteName={SCENERY_COLOR_PALETTE_NAME}
                currValue={prefs.groundPeakColorIndex}
                setColorIndex={(index) => apply(next => next.groundPeakColorIndex = index)}
            />
            <FormRangeInput
                label="Opacity"
                currValue={String(prefs.groundSolidityStep)}
                setValue={(value) => apply(next => next.groundSolidityStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Scale"
                currValue={String(prefs.groundScaleStep)}
                setValue={(value) => apply(next => next.groundScaleStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Softness"
                currValue={String(prefs.groundSoftnessStep)}
                setValue={(value) => apply(next => next.groundSoftnessStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
        </div>
    </>
}

export const AMBIENT_TOOLTIP_BUTTON_ID = "ambientLightTooltipButton";
export const HEAD_LIGHT_TOOLTIP_BUTTON_ID = "headLightTooltipButton";
export const FOG_TOOLTIP_BUTTON_ID = "fogTooltipButton";
export const SMOKE_TOOLTIP_BUTTON_ID = "smokeTooltipButton";
export const CLOUDS_TOOLTIP_BUTTON_ID = "cloudsTooltipButton";
export const GROUND_TOOLTIP_BUTTON_ID = "groundTooltipButton";

// Every quantized setting here runs over the same range, since every one of them is a single stored
// character (see RoomPrefsUtil). An <input> wants its bounds as text.
const MAX_STEP_ATTRIBUTE = String(MAX_ROOM_PREFS_STEP);

interface Props
{
    // Raising this section's explanation, which the form owns so that only one is ever up at a time.
    onToggleTooltip: (targetElementId: string, text: string) => void;
    // Which room is being lit. Always named, whether it is the caller's own or a hub they administer
    // — whether they may light it is the server's to decide from the room (see the room API).
    roomID: string;
}
