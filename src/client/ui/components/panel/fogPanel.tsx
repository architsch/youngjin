import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { FOG_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// Fog settings (see CustomizeRoomPanel, @docs/graphics/lighting.md, useEditableRoomPrefs).
export default function FogPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    // Near can't exceed far: dragging one past the other carries both.
    const setNearStep = (value: string) => apply(next => {
        next.fogNearStep = Number(value);
        next.fogFarStep = Math.max(next.fogFarStep, next.fogNearStep);
    });
    const setFarStep = (value: string) => apply(next => {
        next.fogFarStep = Number(value);
        next.fogNearStep = Math.min(next.fogNearStep, next.fogFarStep);
    });

    return <ScrollPanel id="fogOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="fogTooltipButton" additionalClassNames="self-center"
            text="The air in the room. Things fade into it between where it starts and where it ends — and so does the sky beyond the room, as far as the room stands in front of it."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
            <FormPaletteColorInput
                label="Color"
                paletteName={FOG_COLOR_PALETTE_NAME}
                currValue={prefs.fogColorIndex}
                setColorIndex={(index) => apply(next => next.fogColorIndex = index)}
            />
            <FormRangeInput
                label="Near"
                currValue={String(prefs.fogNearStep)}
                setValue={setNearStep}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Far"
                currValue={String(prefs.fogFarStep)}
                setValue={setFarStep}
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
