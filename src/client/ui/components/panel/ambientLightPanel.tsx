import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// A room's ambient light, raised from the room's settings (see CustomizeRoomPanel): what the light
// that reaches every surface is, and how much of it there is. What each setting means is in
// @docs/graphics/lighting.md, and how an edit reaches the room is in useEditableRoomPrefs.
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

// Every quantized setting of a room runs over the same range, since every one of them is a single
// stored character (see RoomPrefsUtil). An <input> wants its bounds as text.
const MAX_STEP_ATTRIBUTE = String(MAX_ROOM_PREFS_STEP);

// One setting to a line, so that each is within reach without the panel being scrolled sideways to
// find it. The lines are ranged right, which lines the tracks up under each other whatever their
// labels say.
const COLUMN_CLASS_NAMES = "flex flex-col items-end gap-1 shrink-0";

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
