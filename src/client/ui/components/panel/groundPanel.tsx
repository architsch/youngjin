import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { SCENERY_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// The country a room stands over, seen below the horizon, raised from the room's settings (see
// CustomizeRoomPanel). What each setting means is in @docs/graphics/lighting.md, and how an edit
// reaches the room is in useEditableRoomPrefs.
export default function GroundPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="groundOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="groundTooltipButton" additionalClassNames="self-center"
            text="The country your room stands over, seen below the horizon. Low ground is painted in the first color and high ground in the second, so how far apart you pick the two is how mountainous it reads, and Softness is how sharply they meet — a drawn coastline at one end, a long hillside at the other. It fades into the air with distance as land does; Opacity is how long it takes to go."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
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
