import { ReactNode, useEffect, useReducer, useRef, useState } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
import AddPropIcon from "../../../svg/icons/addPropIcon";
import AddDoorIcon from "../../../svg/icons/addDoorIcon";
import AddLampIcon from "../../../svg/icons/addLampIcon";
import AddLabelIcon from "../../../svg/icons/addLabelIcon";
import AddNpcIcon from "../../../svg/icons/addNpcIcon";
import AddVolumeIcon from "../../../svg/icons/addVolumeIcon";
import App from "../../../../app";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import ObjectPlacementUtil from "../../../../object/util/objectPlacementUtil";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import ImageMetadata from "../../../../../shared/graphics/image/types/imageMetadata";
import ImageChoiceUtil from "../../../util/imageChoiceUtil";
import VoxelEditUtil from "../../../../voxel/util/voxelEditUtil";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { clientFeatureFlagsObservable, volumesShownObservable } from "../../../../system/clientObservables";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import ClosablePanelUtil from "../../../util/closablePanelUtil";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import LampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import { CANVAS_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import { PROP_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/propObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import ImageMapThumbnailPanel from "../../panel/imageMapThumbnailPanel";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import PreEncodedCompositionIndexMap from "../../../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
const npcTypeIndex = ObjectTypeConfigMap.getIndexByType("Npc");

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

// Face tools: remove or add a block, or add an object. An object's look is picked first, from a chooser its add button
// raises in the place of the face's other tools (its children), and the pick adds it. The chooser shows beneath this
// row, its add button a toggle, or in the place of this row too until it is closed (see
// SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection, children?: ReactNode})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);
    // The type whose chooser is open, and the selection it was raised on: the next face selected has none open.
    const [chooser, setChooser] = useState<{typeIndex: number, selection: VoxelQuadSelection} | null>(null);
    // Whether a pick from a chooser beneath this row is still going up.
    const addingRef = useRef(false);

    // Re-render this menu only when the feature flags it depends on change (e.g. tutorial steps), or volumes are
    // shown or hidden.
    useEffect(() => {
        for (const flag of placementFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("voxelQuadPlacementOptions", flag, forceRefresh);
        volumesShownObservable.addListener("voxelQuadPlacementOptions", forceRefresh);
        return () => {
            for (const flag of placementFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("voxelQuadPlacementOptions", flag);
            volumesShownObservable.removeListener("voxelQuadPlacementOptions");
        };
    }, []);

    const canAddCanvas = getImages(CANVAS_IMAGE_SUBFOLDER).length > 0
        && ObjectPlacementUtil.canAddObject(props.selection, canvasTypeIndex);
    const propImageFits = ObjectPlacementUtil.getPropImageFits(props.selection);
    const canAddProp = getImages(PROP_IMAGE_SUBFOLDER).some(image => propImageFits(image.path));
    const lampSizeFits = (compositionIndex: number) => ObjectPlacementUtil.canAddObject(props.selection,
        lampTypeIndex, LampObjectTypeConfig.util.getScale(compositionIndex));
    const canAddLamp = (PreEncodedCompositionIndexMap.Lamp ?? []).some(lampSizeFits);

    // Doors and labels: the room's superuser only (see RoomValidationUtil).
    const room = App.getCurrentRoom();
    const isSuperuser = room != undefined &&
        RoomValidationUtil.isRoomSuperuser(App.getUser(), room);
    const canAddDoor = isSuperuser &&
        ObjectPlacementUtil.canAddObject(props.selection, doorTypeIndex);
    const canAddLabel = isSuperuser &&
        ObjectPlacementUtil.canAddObject(props.selection, labelTypeIndex);

    // NPCs (an admin's) and volumes (an admin's or the superuser's, while volumes show; see volumesShownObservable)
    // are added as they are, with nothing to pick first.
    const isAdmin = RoomValidationUtil.userIsAdmin(App.getUser());
    const canAddNpc = isAdmin &&
        ObjectPlacementUtil.canAddObject(props.selection, npcTypeIndex);
    const managesVolumes = (isAdmin || isSuperuser) && volumesShownObservable.peek();
    const canAddVolume = managesVolumes && ObjectPlacementUtil.canAddVolume(props.selection);

    // A chooser shows only while its type can be added to the selected face.
    const canAdd = new Map([[canvasTypeIndex, canAddCanvas], [propTypeIndex, canAddProp], [lampTypeIndex, canAddLamp],
        [labelTypeIndex, canAddLabel], [doorTypeIndex, canAddDoor]]);
    const choosing = (chooser != null && chooser.selection == props.selection && canAdd.get(chooser.typeIndex))
        ? chooser.typeIndex : null;
    const close = () => setChooser(null);
    const onClose = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : close;
    const addButton = (id: string, icon: ReactNode, objectTypeIndex: number) => <IconButton id={id} icon={icon}
        size="md" disabled={!canAdd.get(objectTypeIndex)} highlight={choosing == objectTypeIndex}
        onClick={() => setChooser(objectTypeIndex == choosing ? null
            : {typeIndex: objectTypeIndex, selection: props.selection})}/>;

    // The back gesture puts away a chooser beneath this row, as its add button does (see ClosablePanelUtil): not as a
    // panel over the tools, which this row stays on screen as. One in the row's place sees to that itself (see
    // ScrollPanel).
    useEffect(() => {
        if (!SUB_PANELS_BENEATH_SELECTION_TOOLS || choosing == null)
            return;
        const token = ClosablePanelUtil.register(() => setChooser(null), false);
        return () => ClosablePanelUtil.unregister(token);
    }, [choosing]);

    // A pick closes a chooser in this row's place at once, so a second click can't add another while the first goes
    // up. One beneath the row stays up as it is meanwhile, taking no other pick; once the object is up it is put away,
    // where this menu outlives it (see ObjectPlacementUtil).
    const add = async (tryAdd: () => Promise<void>) => {
        if (!SUB_PANELS_BENEATH_SELECTION_TOOLS)
        {
            close();
            tryAdd();
            return;
        }
        if (addingRef.current)
            return;
        addingRef.current = true;
        try {
            await tryAdd();
        } finally {
            addingRef.current = false;
            close();
        }
    };

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {(SUB_PANELS_BENEATH_SELECTION_TOOLS || choosing == null) && <SelectionToolRow>
            <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!VoxelEditUtil.canRemoveVoxelBlock(props.selection)}
                onClick={() => VoxelEditUtil.tryRemoveVoxelBlock(props.selection)}/>
            <IconButton id="addVoxelBlockButton" icon={<AddBlockIcon/>} size="md"
                disabled={!VoxelEditUtil.canAddVoxelBlock(props.selection)}
                onClick={() => VoxelEditUtil.tryAddVoxelBlock(props.selection)}/>
            {addButton("addCanvasButton", <AddCanvasIcon/>, canvasTypeIndex)}
            {addButton("addPropButton", <AddPropIcon/>, propTypeIndex)}
            {addButton("addLampButton", <AddLampIcon/>, lampTypeIndex)}
            {isSuperuser && addButton("addLabelButton", <AddLabelIcon/>, labelTypeIndex)}
            {isSuperuser && addButton("addDoorButton", <AddDoorIcon/>, doorTypeIndex)}
            {isAdmin && <IconButton id="addNpcButton" icon={<AddNpcIcon/>} size="md"
                disabled={!canAddNpc} onClick={() => ObjectPlacementUtil.tryAddNpc(props.selection)}/>}
            {managesVolumes && <IconButton id="addVolumeButton" icon={<AddVolumeIcon/>} size="md"
                disabled={!canAddVolume} onClick={() => ObjectPlacementUtil.tryAddVolume(props.selection)}/>}
        </SelectionToolRow>}
        {choosing == canvasTypeIndex && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            onChoose={path => add(() => ObjectPlacementUtil.tryAddCanvas(props.selection, path))}
            onClose={onClose}
        />}
        {choosing == propTypeIndex && <ImageMapThumbnailPanel
            id="propImageOptions"
            searchInputId="propImageSearchInput"
            searchPlaceholder="Search"
            mapName="PictureImageMap"
            subfolder={PROP_IMAGE_SUBFOLDER}
            canChoose={propImageFits}
            onChoose={path => add(() => ObjectPlacementUtil.tryAddProp(props.selection, path))}
            onClose={onClose}
        />}
        {choosing == lampTypeIndex && <CompositionThumbnailPanel
            id="lampSizeOptions"
            objectType={LampObjectTypeConfig.objectType}
            canChoose={lampSizeFits}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddLamp(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == labelTypeIndex && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddLabel(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == doorTypeIndex && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddDoor(props.selection, compositionIndex))}
            onClose={onClose}
        />}
        {choosing == null && props.children}
    </div>;
}

// The picture map's images a canvas (paintings) or a prop (everyday objects) may be added with, as its chooser
// offers them.
function getImages(subfolder: string): ImageMetadata[]
{
    return ImageChoiceUtil.getOffered(ImageMapUtil.getImageMap("PictureImageMap"), subfolder, !App.isPublicSite());
}
