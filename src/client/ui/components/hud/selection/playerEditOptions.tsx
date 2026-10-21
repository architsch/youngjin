import IconButton from "../../input/iconButton";
import DropdownInput from "../../input/dropdownInput";
import StepperInput from "../../input/stepperInput";
import Text from "../../basic/text";
import TrashIcon from "../../../svg/icons/trashIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CustomizePlayerPanel from "../../panel/customizePlayerPanel";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import NpcObjectTypeConfig, {
    NPC_WANDER_RADII } from "../../../../../shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import NpcPersonalityMap from "../../../../../shared/object/maps/npcPersonalityMap";
import { OBJECT_NAME_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import ObjectMetadataTextInput from "./objectMetadataTextInput";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

const PERSONALITY_OPTIONS = NpcPersonalityMap.getEntries().map(entry =>
    ({value: entry.id, label: entry.label, description: entry.description}));
const WANDER_RADIUS_LABELS = NPC_WANDER_RADII.map(radius => String(radius));

// Tools for a selected character. The user's own has only its looks to set. An NPC, which is an admin's to lay,
// has more: remove, its name, a clockwise quarter-turn of the way it faces, the character it is played as, and its
// looks, whose panel shows beneath this row, or in its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
// One whose character is played also has how far from home it goes (shown round it, see NpcGameObject).
export default function PlayerEditOptions(props: EditOptionsProps)
{
    const gameObject = props.selection.gameObject;
    if (gameObject.config != NpcObjectTypeConfig)
        return <CustomizePlayerPanel gameObject={gameObject}/>;

    const customizing = props.openPanel == "playerParts";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || !customizing;
    // Read off the NPC each render, as every edit of it re-announces the selection (see ClientObjectManager).
    const personality = NpcObjectTypeConfig.util.getPersonality(gameObject.params);
    const wanderRadius = NpcObjectTypeConfig.util.getWanderRadius(gameObject.params);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {toolsShown && <SelectionToolRow>
            <IconButton id="removeNpcButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this character?")}
            />
            <ObjectMetadataTextInput id="npcNameInput" selection={props.selection}
                metadataKey={ObjectMetadataKeyEnumMap.Label} maxLength={OBJECT_NAME_MAX_LENGTH}
                placeholder="Name" additionalClassNames="w-36"/>
            <IconButton id="customizeNpcButton" icon={<PersonIcon/>} size="md"
                highlight={customizing}
                onClick={() => props.setOpenPanel("playerParts")}
            />
            <IconButton id="rotateNpcButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Personality" size="sm" additionalClassNames="shrink-0"/>
                <DropdownInput id="npcPersonalityInput" options={PERSONALITY_OPTIONS} currValue={personality}
                    setValue={(id) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.Personality, id)}
                    disabled={!canEditNpc(props.selection, ObjectMetadataKeyEnumMap.Personality)}
                />
            </div>
            {NpcPersonalityMap.isPlayed(personality) && <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Wander" size="sm" additionalClassNames="shrink-0"/>
                <StepperInput
                    currValue={NPC_WANDER_RADII.indexOf(wanderRadius)}
                    numValues={NPC_WANDER_RADII.length}
                    labels={WANDER_RADIUS_LABELS}
                    // Written immediately (not deferred): a discrete edit, with few values.
                    setValue={(step) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                        ObjectMetadataKeyEnumMap.WanderRadius, String(NPC_WANDER_RADII[step]))}
                    disabled={!canEditNpc(props.selection, ObjectMetadataKeyEnumMap.WanderRadius)}
                />
            </div>}
        </SelectionToolRow>}
        {customizing && <CustomizePlayerPanel gameObject={gameObject}
            onClose={SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null)}/>}
    </div>;
}

// Asked of the value's own key, so this comes down to permissions (see NpcObjectTypeConfig).
function canEditNpc(selection: ObjectSelection, metadataKey: ObjectMetadataKey): boolean
{
    const currentValue = selection.gameObject.params.metadata[metadataKey]?.str ?? "";
    return ObjectEditUtil.canSetObjectMetadata(selection, metadataKey, currentValue);
}
