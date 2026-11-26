import { ReactNode, useEffect, useReducer, useRef, useState } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import Button from "../../input/button";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddVolumeIcon from "../../../svg/icons/addVolumeIcon";
import SelectionSubmenu from "./selectionSubmenu";
import PetGenerationUtil from "../../../util/petGenerationUtil";
import App from "../../../../app";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import ObjectPlacementUtil from "../../../../object/util/objectPlacementUtil";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import ImageMetadata from "../../../../../shared/graphics/image/types/imageMetadata";
import ImageChoiceUtil from "../../../util/imageChoiceUtil";
import VoxelEditUtil from "../../../../voxel/util/voxelEditUtil";
import DoorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { clientFeatureFlagsObservable, dollarsInFlightObservable, inventoryObservable,
    volumesShownObservable } from "../../../../system/clientObservables";
import { ADD_BUTTONS_IN_SUBMENUS, SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import { CANNON_PRICE_DOLLARS, PET_PRICE_DOLLARS } from "../../../../../shared/system/sharedConstants";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import ClientInventoryManager from "../../../../inventory/clientInventoryManager";
import PriceTag from "../../basic/priceTag";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import ClosablePanelUtil from "../../../util/closablePanelUtil";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import LampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import MirrorObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
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
const fanTypeIndex = ObjectTypeConfigMap.getIndexByType("Fan");
const mirrorTypeIndex = ObjectTypeConfigMap.getIndexByType("Mirror");
const cannonTypeIndex = ObjectTypeConfigMap.getIndexByType("Cannon");

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

// The kinds the add buttons are grouped by (see ADD_BUTTONS_IN_SUBMENUS): what dresses a room up, what moves by itself,
// and what keeps it company. Each is a button in the tool row, by this id.
type AddMenu = "decoration" | "machine" | "companion";
const ADD_MENU_BUTTON_IDS: {[menu in AddMenu]: string} = {
    decoration: "decorationMenuButton", machine: "machineMenuButton", companion: "companionMenuButton"};
// Its text buttons are small, but their words as heavy as the other tools' (see Button).
const TEXT_BUTTON_CLASS_NAMES = "shrink-0 font-semibold";
// In a kind's column, the add buttons share one width, wide enough for the longest words there, so that they line up.
const KIND_BUTTON_CLASS_NAMES = ADD_BUTTONS_IN_SUBMENUS ? `${TEXT_BUTTON_CLASS_NAMES} min-w-20` : TEXT_BUTTON_CLASS_NAMES;

// Face tools: remove or add a block, or add an object. The objects are offered by kind: each kind's button raises its
// add buttons in a column over it, and raising another kind's column puts away the one that was up (or every add
// button is in the row itself; see ADD_BUTTONS_IN_SUBMENUS). An object's look is picked first, from a chooser its add
// button raises in the place of the face's tools (this row and its children), and the pick adds it. The chooser's
// close button returns to the row as it was, its column still up. A pet is generated from a popup of its own (see
// GeneratePetForm).
export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection, children?: ReactNode})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);
    // The type whose chooser is open, and the selection it was raised on: the next face selected has none open.
    const [chooser, setChooser] = useState<{typeIndex: number, selection: VoxelQuadSelection} | null>(null);
    // The kind whose add buttons are raised, likewise.
    const [raisedMenu, setRaisedMenu] = useState<{menu: AddMenu, selection: VoxelQuadSelection} | null>(null);
    // Whether a pick from a chooser beneath this row is still going up.
    const addingRef = useRef(false);

    // Re-render this menu only when the feature flags it depends on change (e.g. tutorial steps), volumes are shown
    // or hidden, or the dollars the user's count shows change, which what costs any is offered by.
    useEffect(() => {
        for (const flag of placementFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("voxelQuadPlacementOptions", flag, forceRefresh);
        volumesShownObservable.addListener("voxelQuadPlacementOptions", forceRefresh);
        inventoryObservable.addListener("voxelQuadPlacementOptions", forceRefresh);
        dollarsInFlightObservable.addListener("voxelQuadPlacementOptions", forceRefresh);
        return () => {
            for (const flag of placementFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("voxelQuadPlacementOptions", flag);
            volumesShownObservable.removeListener("voxelQuadPlacementOptions");
            inventoryObservable.removeListener("voxelQuadPlacementOptions");
            dollarsInFlightObservable.removeListener("voxelQuadPlacementOptions");
        };
    }, []);

    const canAddCanvas = getImages(CANVAS_IMAGE_SUBFOLDER).length > 0
        && ObjectPlacementUtil.canAddObject(props.selection, canvasTypeIndex);
    const propImageFits = ObjectPlacementUtil.getPropImageFits(props.selection);
    const canAddProp = getImages(PROP_IMAGE_SUBFOLDER).some(image => propImageFits(image.path));
    const lampSizeFits = (compositionIndex: number) => ObjectPlacementUtil.canAddObject(props.selection,
        lampTypeIndex, LampObjectTypeConfig.util.getScale(compositionIndex));
    const canAddLamp = (PreEncodedCompositionIndexMap.Lamp ?? []).some(lampSizeFits);
    // A fan has one look and one size, so it is added as it is.
    const canAddFan = ObjectPlacementUtil.canAddObject(props.selection, fanTypeIndex);
    // So is a cannon, by whoever has the dollars it costs. Only a room the server plays has any.
    const offersCannon = App.getCurrentRoom()?.roomType != RoomTypeEnumMap.SinglePlayer;
    const canAddCannon = offersCannon && ClientInventoryManager.getDollarsShown() >= CANNON_PRICE_DOLLARS
        && ObjectPlacementUtil.canAddObject(props.selection, cannonTypeIndex);

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
    // A mirror is an admin's too, its frame picked first.
    const canAddMirror = isAdmin && ObjectPlacementUtil.canAddObject(props.selection, mirrorTypeIndex);
    // Pets are only where the server plays them. One is generated by whoever has the dollars it costs, on a floor with
    // room for it.
    const offersPets = PetGenerationUtil.isOffered();
    const canAddPet = offersPets && PetGenerationUtil.canGenerate(props.selection);

    // A chooser shows only while its type can be added to the selected face.
    const canAdd = new Map([[canvasTypeIndex, canAddCanvas], [propTypeIndex, canAddProp], [lampTypeIndex, canAddLamp],
        [labelTypeIndex, canAddLabel], [doorTypeIndex, canAddDoor], [mirrorTypeIndex, canAddMirror]]);
    const choosing = (chooser != null && chooser.selection == props.selection && canAdd.get(chooser.typeIndex))
        ? chooser.typeIndex : null;
    const close = () => setChooser(null);
    const raised = (ADD_BUTTONS_IN_SUBMENUS && raisedMenu != null && raisedMenu.selection == props.selection)
        ? raisedMenu.menu : null;
    // A chooser's add button leaves any column up, hidden behind the chooser, for putting the chooser away to return to.
    const addButton = (id: string, name: string, objectTypeIndex: number, classNames = KIND_BUTTON_CLASS_NAMES) =>
        <Button id={id} key={id} name={name} mark="add" size="sm" additionalClassNames={classNames}
            disabled={!canAdd.get(objectTypeIndex)}
            onClick={() => setChooser({typeIndex: objectTypeIndex, selection: props.selection})}/>;
    // One that adds its object as it is, with nothing to pick first, and puts its kind's column away; with what it
    // costs beside it in a column, or under it in the row, if anything.
    const plainButton = (id: string, name: string, enabled: boolean, add: () => void, price?: number) => {
        const button = <Button id={id} key={id} name={name} mark="add" size="sm"
            additionalClassNames={KIND_BUTTON_CLASS_NAMES} disabled={!enabled} onClick={() => {
                setRaisedMenu(null);
                add();
            }}/>;
        if (price == undefined)
            return button;
        return ADD_BUTTONS_IN_SUBMENUS
            ? <div key={id} className="flex flex-row items-center gap-1.5 shrink-0">{button}<PriceTag dollars={price}/></div>
            : <div key={id} className="relative shrink-0">
                {button}
                <PriceTag dollars={price} additionalClassNames="absolute top-full left-1/2 -translate-x-1/2 mt-1"/>
            </div>;
    };

    // Every add button there is for this user here, by kind, in the order each kind offers them (the first nearest its
    // menu button). The buttons ScreenControlMap names are pictured in messages by hand-made copies (see
    // ScreenControlPicture): new words, a new mark or color for one goes there too.
    const addButtons: {[menu in AddMenu]: ReactNode[]} = {
        decoration: [
            addButton("addCanvasButton", "Canvas", canvasTypeIndex),
            addButton("addPropButton", "Prop", propTypeIndex),
            addButton("addLampButton", "Lamp", lampTypeIndex),
            isSuperuser && addButton("addLabelButton", "Label", labelTypeIndex),
            isAdmin && addButton("addMirrorButton", "Mirror", mirrorTypeIndex),
        ],
        machine: [
            plainButton("addFanButton", "Fan", canAddFan, () => ObjectPlacementUtil.tryAddFan(props.selection)),
            offersCannon && plainButton("addCannonButton", "Cannon", canAddCannon,
                () => ObjectPlacementUtil.tryAddCannon(props.selection), CANNON_PRICE_DOLLARS),
        ],
        companion: [
            isAdmin && plainButton("addNpcButton", "NPC", canAddNpc,
                () => ObjectPlacementUtil.tryAddNpc(props.selection)),
            offersPets && plainButton("addPetButton", "Pet", canAddPet,
                () => PetGenerationUtil.open(props.selection), PET_PRICE_DOLLARS),
        ],
    };
    const menuButton = (menu: AddMenu, name: string) => addButtons[menu].some(button => button) && <Button
        id={ADD_MENU_BUTTON_IDS[menu]} key={menu} name={name} mark="more" size="sm"
        additionalClassNames={TEXT_BUTTON_CLASS_NAMES} highlight={raised == menu}
        onClick={() => setRaisedMenu(raised == menu ? null : {menu, selection: props.selection})}/>;

    // The back gesture puts away a kind's column (not over the tools; see ClosablePanelUtil), after any chooser raised
    // in front of it, whose close button is always newer on the stack (see ScrollPanel).
    useEffect(() => {
        if (raised == null)
            return;
        const token = ClosablePanelUtil.register(() => setRaisedMenu(null), false);
        return () => ClosablePanelUtil.unregister(token);
    }, [raised]);

    // A pick closes the chooser at once, so a second click can't add another while the first goes up; with sub-panels
    // beneath the tools, it stays up as it is meanwhile, taking no other pick, and is put away once the object is up,
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

    // Full width, so the rows can scroll horizontally instead of growing. With every add button in the row, it is
    // deeper beneath its buttons where one of them has a price to show there.
    const rowHoldsPrices = !ADD_BUTTONS_IN_SUBMENUS && (offersCannon || offersPets);
    return <div className="flex flex-col gap-1 w-full">
        {choosing == null && <SelectionToolRow additionalClassNames={rowHoldsPrices ? "pb-6" : ""}>
            <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="sm" color="red" shortcutKey="Delete"
                disabled={!VoxelEditUtil.canRemoveVoxelBlock(props.selection)}
                onClick={() => VoxelEditUtil.tryRemoveVoxelBlock(props.selection)}/>
            <IconButton id="addVoxelBlockButton" icon={<AddBlockIcon/>} size="sm"
                disabled={!VoxelEditUtil.canAddVoxelBlock(props.selection)}
                onClick={() => VoxelEditUtil.tryAddVoxelBlock(props.selection)}/>
            {ADD_BUTTONS_IN_SUBMENUS && menuButton("decoration", "Decor")}
            {ADD_BUTTONS_IN_SUBMENUS && menuButton("machine", "Toy")}
            {ADD_BUTTONS_IN_SUBMENUS && menuButton("companion", "Robot")}
            {!ADD_BUTTONS_IN_SUBMENUS && [...addButtons.decoration, ...addButtons.machine, ...addButtons.companion]}
            {isSuperuser && addButton("addDoorButton", "Door", doorTypeIndex, TEXT_BUTTON_CLASS_NAMES)}
            {managesVolumes && <IconButton id="addVolumeButton" icon={<AddVolumeIcon/>} size="sm"
                disabled={!canAddVolume} onClick={() => ObjectPlacementUtil.tryAddVolume(props.selection)}/>}
        </SelectionToolRow>}
        {raised != null && choosing == null && <SelectionSubmenu
            anchorId={ADD_MENU_BUTTON_IDS[raised]} id={`${raised}Submenu`}>
            {addButtons[raised]}
        </SelectionSubmenu>}
        {choosing == canvasTypeIndex && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            onChoose={path => add(() => ObjectPlacementUtil.tryAddCanvas(props.selection, path))}
            onClose={close}
        />}
        {choosing == propTypeIndex && <ImageMapThumbnailPanel
            id="propImageOptions"
            searchInputId="propImageSearchInput"
            searchPlaceholder="Search"
            mapName="PictureImageMap"
            subfolder={PROP_IMAGE_SUBFOLDER}
            canChoose={propImageFits}
            onChoose={path => add(() => ObjectPlacementUtil.tryAddProp(props.selection, path))}
            onClose={close}
        />}
        {choosing == lampTypeIndex && <CompositionThumbnailPanel
            id="lampSizeOptions"
            objectType={LampObjectTypeConfig.objectType}
            canChoose={lampSizeFits}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddLamp(props.selection, compositionIndex))}
            onClose={close}
        />}
        {choosing == labelTypeIndex && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddLabel(props.selection, compositionIndex))}
            onClose={close}
        />}
        {choosing == doorTypeIndex && <CompositionThumbnailPanel
            id="customizeDoorOptions"
            objectType={DoorObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddDoor(props.selection, compositionIndex))}
            onClose={close}
        />}
        {choosing == mirrorTypeIndex && <CompositionThumbnailPanel
            id="customizeMirrorOptions"
            objectType={MirrorObjectTypeConfig.objectType}
            onChoose={compositionIndex => add(() => ObjectPlacementUtil.tryAddMirror(props.selection, compositionIndex))}
            onClose={close}
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
