import { useEffect, useState } from "react";
import Text from "../basic/text";
import DropdownInput from "../input/dropdownInput";
import RangeInput from "../input/rangeInput";
import StepperInput from "../input/stepperInput";
import Checkbox from "../input/checkbox";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import NpcGameObject from "../../../object/types/gameObject/npcGameObject";
import ObjectEditUtil from "../../util/objectEditUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import BehaviorPrefs from "../../../../shared/object/types/behaviorPrefs";
import BehaviorPrefsUtil, { LONGEST_IDLE_TIME, MAX_WANDER_RADIUS,
    SHORTEST_IDLE_TIME } from "../../../../shared/object/util/behaviorPrefsUtil";
import NpcPersonalityMap from "../../../../shared/object/maps/npcPersonalityMap";
import ScrollPanel from "./scrollPanel";

const PERSONALITY_OPTIONS = NpcPersonalityMap.getEntries().map(entry =>
    ({value: entry.id, label: entry.label, description: entry.description}));
const MAX_WANDER_RADIUS_ATTRIBUTE = String(MAX_WANDER_RADIUS);
// As many ticks as read well (see RangeInput), each a few units on.
const WANDER_RADIUS_TICK_STEP = "5";
const IDLE_TIME_LABELS = Array.from({length: LONGEST_IDLE_TIME - SHORTEST_IDLE_TIME + 1},
    (_, index) => `${SHORTEST_IDLE_TIME + index} sec`);

// Edits how an NPC is played (its BehaviorPrefs): the character it is played as, and one whose character is played also
// how far from home it wanders (shown round it, as the slider moves too, see NpcGameObject), the least and the most it
// idles between wanders, whether it may climb to other floors, and whether it goes back home after each wander. Each
// change is saved as it is made, the slider's once it is let go of.
export default function CustomizeNpcBehaviorPanel({ selection, onClose }: Props)
{
    const objectId = selection.gameObject.params.objectId;
    // The radius the wander slider is dragged through, until it is let go of.
    const [draggedRadius, setDraggedRadius] = useState<number | undefined>(undefined);
    useEffect(() => {
        setDraggedRadius(undefined);
        return () => NpcGameObject.previewWanderRadius(objectId, undefined);
    }, [objectId]);

    // Read off the NPC each render, as every edit of it re-announces the selection (see ClientObjectManager).
    const prefs = BehaviorPrefsUtil.getObjectPrefs(selection.gameObject.params);
    // Asked of the stored value itself, so this comes down to permissions (see NpcObjectTypeConfig).
    const storedPrefs = selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.BehaviorPrefs]?.str ?? "";
    const canEdit = ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.BehaviorPrefs, storedPrefs);

    const apply = (edit: (next: BehaviorPrefs) => void) => {
        const next = {...prefs};
        edit(next);
        ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.BehaviorPrefs,
            BehaviorPrefsUtil.encode(next));
    };
    const dragRadius = (radius: number | undefined) => {
        setDraggedRadius(radius);
        NpcGameObject.previewWanderRadius(objectId, radius);
    };

    return <ScrollPanel id="customizeNpcBehaviorOptions" onClose={onClose}>
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Personality" size="sm"/>
            <DropdownInput id="npcPersonalityInput" options={PERSONALITY_OPTIONS} currValue={prefs.personality}
                setValue={(id) => apply(next => next.personality = NpcPersonalityMap.read(id))}
                disabled={!canEdit}
            />
        </div>
        {NpcPersonalityMap.isPlayed(prefs.personality) && <>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Wander Radius" size="sm"/>
                <RangeInput id="npcWanderRadiusInput"
                    currValue={String(draggedRadius ?? prefs.wanderRadius)}
                    setValue={(value) => dragRadius(Number(value))}
                    commitValue={(value) => {
                        dragRadius(undefined);
                        apply(next => next.wanderRadius = Number(value));
                    }}
                    min="0" max={MAX_WANDER_RADIUS_ATTRIBUTE} step="1" tickStep={WANDER_RADIUS_TICK_STEP}
                    disabled={!canEdit}
                    additionalClassNames="w-40"
                />
            </div>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            {/* A pair, so the time just picked is kept, and the other one moved to it if it has to be. */}
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Min Idle Time" size="sm"/>
                <StepperInput id="npcMinIdleTimeInput"
                    currValue={prefs.minIdleTime - SHORTEST_IDLE_TIME}
                    numValues={IDLE_TIME_LABELS.length}
                    setValue={(index) => apply(next => {
                        next.minIdleTime = SHORTEST_IDLE_TIME + index;
                        next.maxIdleTime = Math.max(next.maxIdleTime, next.minIdleTime);
                    })}
                    labels={IDLE_TIME_LABELS}
                    disabled={!canEdit}
                />
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Max Idle Time" size="sm"/>
                <StepperInput id="npcMaxIdleTimeInput"
                    currValue={prefs.maxIdleTime - SHORTEST_IDLE_TIME}
                    numValues={IDLE_TIME_LABELS.length}
                    setValue={(index) => apply(next => {
                        next.maxIdleTime = SHORTEST_IDLE_TIME + index;
                        next.minIdleTime = Math.min(next.minIdleTime, next.maxIdleTime);
                    })}
                    labels={IDLE_TIME_LABELS}
                    disabled={!canEdit}
                />
            </div>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <Checkbox id="npcCanClimbInput" label="Can Climb Up/Down" size="sm"
                checked={prefs.canClimb} disabled={!canEdit}
                onChange={(checked) => apply(next => next.canClimb = checked)}
                additionalClassNames="shrink-0"/>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <Checkbox id="npcAnchoredInput" label="Anchored to Home Spot" size="sm"
                checked={prefs.anchoredToHome} disabled={!canEdit}
                onChange={(checked) => apply(next => next.anchoredToHome = checked)}
                additionalClassNames="shrink-0"/>
        </>}
    </ScrollPanel>;
}

interface Props
{
    selection: ObjectSelection;
    // Absent means it has no close button (see ScrollPanel).
    onClose?: () => void;
}
