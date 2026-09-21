import { MAX_ROOM_INITIAL_JOIN_PRIORITY } from "../../../../shared/room/util/roomPrefsUtil";
import useEditableRoomPrefs from "../../util/editableRoomPrefs";
import TooltipButton from "../input/tooltipButton";
import FormStepperInput from "../input/formStepperInput";
import ScrollPanel from "./scrollPanel";

// Where this hub stands in the order arriving visitors fill hubs in (see CustomizeRoomPanel,
// @docs/networking/room_population.md, useEditableRoomPrefs).
export default function InitialJoinPriorityPanel({ anchorElementId, onClose }: Props)
{
    const [prefs, apply] = useEditableRoomPrefs();

    return <ScrollPanel id="initialJoinPriorityOptions" anchorElementId={anchorElementId} onClose={onClose}>
        <TooltipButton id="initialJoinPriorityTooltipButton" additionalClassNames="self-center"
            text="Which hub newcomers are sent to first. The lowest number goes first, and a hub is filled to a healthy crowd before the next one opens up."/>
        <FormStepperInput
            label="Order"
            currValue={prefs.initialJoinPriority}
            numValues={PRIORITY_LABELS.length}
            setValue={(value) => apply(next => next.initialJoinPriority = value)}
            labels={PRIORITY_LABELS}
        />
    </ScrollPanel>;
}

// The priority itself, rather than the stepper's default "position of many".
const PRIORITY_LABELS = Array.from({length: MAX_ROOM_INITIAL_JOIN_PRIORITY + 1}, (_, i) => String(i));

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
