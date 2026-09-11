import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import { SCENERY_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormPaletteColorInput from "../input/formPaletteColorInput";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// The clouds in the sky past a room — the weather outside it — raised from the room's settings (see
// CustomizeRoomPanel). What each setting means is in @docs/graphics/lighting.md, and how an edit
// reaches the room is in useEditableRoomPrefs.
export default function CloudsPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="cloudsOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="cloudsTooltipButton" additionalClassNames="self-center"
            text="Drifting cloud in the sky past your room — the air outside it, where Smoke is the air inside. Strength is how much weather there is at all, and starts at none. The clouds are painted in their own color and the sky between them in the fog's, so the further apart you pick the two the stronger they read. Softness is how sharp the edge of a cloud is, from cut to no edge at all."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
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
