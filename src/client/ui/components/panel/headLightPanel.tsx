import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// A room's head light — the light every visitor carries — raised from the room's settings (see
// CustomizeRoomPanel). What each setting means is in @docs/graphics/lighting.md, and how an edit
// reaches the room is in useEditableRoomPrefs.
export default function HeadLightPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="headLightOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="headLightTooltipButton" additionalClassNames="self-center"
            text="The light every visitor carries with them. Power is how much of it there is — turn it down in a room you have lit yourself, so that your own lights are what is seen. Range is how far it reaches and how sharply it fades on the way, which is the difference between a pool around your feet and a wash that fills the room."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
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
