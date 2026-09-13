import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { FOG_COLOR_PALETTE_NAME, SCENERY_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// Sky and cloud settings (see CustomizeRoomPanel, @docs/graphics/lighting.md, useEditableRoomPrefs).
export default function SkyPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="skyOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="skyTooltipButton" additionalClassNames="self-center"
            text="The sky past your room, and the cloud drifting across it — the air outside it, where Smoke is the air inside. The sky and the clouds each have a color of their own, so the further apart you pick the two the stronger the clouds read. Strength is how much weather there is at all, and starts at none. Softness is how sharp the edge of a cloud is, from cut to no edge at all. Your room's fog is laid over the sky as well, as far as the room stands in front of it."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
            {/* Sky uses the fog palette; clouds use the scenery palette (see RoomPrefs). */}
            <FormPaletteColorInput
                label="Sky Color"
                paletteName={FOG_COLOR_PALETTE_NAME}
                currValue={prefs.skyColorIndex}
                setColorIndex={(index) => apply(next => next.skyColorIndex = index)}
            />
            <FormPaletteColorInput
                label="Cloud Color"
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
    </ScrollPanel>;
}

// All room prefs share one step range (one stored character each; see RoomPrefsUtil).
const MAX_STEP_ATTRIBUTE = String(MAX_ROOM_PREFS_STEP);

// One setting per line, right-aligned so tracks line up.
const COLUMN_CLASS_NAMES = "flex flex-col items-end gap-1 shrink-0";

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
