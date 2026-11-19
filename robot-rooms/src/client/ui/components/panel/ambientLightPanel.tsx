import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// Ambient light settings (see CustomizeRoomPanel, @docs/graphics/lighting.md, useEditableRoomPrefs).
export default function AmbientLightPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="ambientLightOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="ambientLightTooltipButton" additionalClassNames="self-center"
            text="The light that fills the whole room, reaching every surface no matter which way it faces."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
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
