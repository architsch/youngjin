import { MAX_ROOM_PREFS_STEP } from "../../../../shared/room/util/roomPrefsUtil";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormRangeInput from "../input/formRangeInput";
import ScrollPanel from "./scrollPanel";

// A room's smoke — the unevenness of the air inside it — raised from the room's settings (see
// CustomizeRoomPanel). What each setting means is in @docs/graphics/lighting.md, and how an edit
// reaches the room is in useEditableRoomPrefs.
export default function SmokePanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="smokeOptions" anchorElementId={anchorElementId} onClose={onClose} size="lg">
        {/*<TooltipButton id="smokeTooltipButton" additionalClassNames="self-center"
            text="The air in your room, unevenly thick rather than an even wash. Where the smoke gathers the fog thins and the room shows through, so Strength is how far it clears — at nothing the air is even again. Drift and Rise are which way it goes: level for dry ice pouring across a floor, climbing for smoke coming off something."/>
        */}
        <div className={COLUMN_CLASS_NAMES}>
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
