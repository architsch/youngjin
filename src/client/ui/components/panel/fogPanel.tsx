import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { FOG_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// A room's fog, raised from the room's settings (see CustomizeRoomPanel): what the air in the room
// is, and where things start and finish fading into it. What each setting means is in
// @docs/graphics/lighting.md, and how an edit reaches the room is in useEditableRoomPrefs.
export default function FogPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="fogOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="fogTooltipButton" additionalClassNames="self-center"
            text="The air in the room. Things fade into it between where it starts and where it ends — and beyond the room, it is all there is."/>
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
                setValue={(value) => apply(next => next.fogNearStep = Number(value))}
                min="0" max={MAX_STEP_ATTRIBUTE} step="1"
            />
            <FormRangeInput
                label="Far"
                currValue={String(prefs.fogFarStep)}
                setValue={(value) => apply(next => next.fogFarStep = Number(value))}
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
