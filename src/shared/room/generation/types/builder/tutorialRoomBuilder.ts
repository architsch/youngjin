import RoomBuilder from "./roomBuilder";
import AddObjectSignal from "../../../../object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../../object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../../object/types/objectTransform";
import RoomVolumeUtil from "../../util/roomVolumeUtil";
import ColorUtil from "../../../../math/util/colorUtil";
import EncodableByteString from "../../../../networking/types/encodableByteString";
import CompositionMetadataUtil from "../../../../graphics/mesh/composition/util/compositionMetadataUtil";
import DoorCompositionConstants from "../../../../graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { DoorTypeEnumMap } from "../../../../object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../../object/types/objectMetadataKey";
import { HUB_ROOM_ID_KEYWORD, LABEL_COLOR_PALETTE_NAME } from "../../../../system/sharedConstants";

// The tutorial's fixtures have explicit appearances (not derived defaults), so the first thing players
// see is always the same.
const RECEPTIONIST_APPEARANCE = CompositionMetadataUtil.encode(
    InstancedMeshCompositionCodecTypeEnumMap.Player, 0,
    {
        // Plainest parts except the brimmed hat, which marks him as staff.
        types: {head: 0, ear: 0, hat: 1, torso: 0, arm: 0, bottom: 0},
        colors: playerColors({
            head: "#c6b492", ear: "#c6b492", hat: "#95002d",
            torso: "#95002d", arm: "#95002d", bottom: "#2a2a2a",
        }),
    });

// Pine with a putty plate and brass knob (shows grain and joinery best).
const TUTORIAL_DOOR_PRESET_INDEX = 0;

const TUTORIAL_DOOR_APPEARANCE = CompositionMetadataUtil.encode(
    InstancedMeshCompositionCodecTypeEnumMap.Door, 0,
    {colors: DoorCompositionConstants.presets[TUTORIAL_DOOR_PRESET_INDEX]});

// Dark grey label ink, snapped to the lettering palette.
const TUTORIAL_DOOR_LABEL_COLOR_INDEX = ColorUtil.rgbToPaletteIndex(
    LABEL_COLOR_PALETTE_NAME, ColorUtil.hexToRGB("#33302c"));

// Four small spaces with distinct palettes, walked through in turn, plus two named fixtures. The walls
// between spaces stay solid until a scripted step opens them.
export default class TutorialRoomBuilder extends RoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const {params, room} = this;
        const voxels = room.voxelGrid.voxels;
        RoomVolumeUtil.carveOutVolume(voxels, params.volumes.room1);
        RoomVolumeUtil.carveOutVolume(voxels, params.volumes.room2);
        RoomVolumeUtil.carveOutVolume(voxels, params.volumes.room3);
        RoomVolumeUtil.carveOutVolume(voxels, params.volumes.room4);

        // Add the NPC.
        room.objectGroup.objectById["npc"] = new AddObjectSignal("", "@npc", "Receptionist",
            ObjectTypeConfigMap.getIndexByType("Player"), "npc",
            new ObjectTransform(params.hotspots.npc, {x: 1, y: 0, z: 0}),
            {
                [ObjectMetadataKeyEnumMap.InstancedMeshComposition]:
                    new EncodableByteString(RECEPTIONIST_APPEARANCE),
            });

        // The exit door points at the hubs, so leaving the tutorial goes to a balanced hub.
        room.objectGroup.objectById["door"] = new AddObjectSignal("", "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), "door",
            new ObjectTransform(params.hotspots.door, {x: 0, y: 0, z: 1}),
            {
                [ObjectMetadataKeyEnumMap.InstancedMeshComposition]:
                    new EncodableByteString(TUTORIAL_DOOR_APPEARANCE),
                [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Door"),
                [ObjectMetadataKeyEnumMap.LabelColor]:
                    new EncodableByteString(`${TUTORIAL_DOOR_LABEL_COLOR_INDEX}`),
                [ObjectMetadataKeyEnumMap.DestinationRoomId]:
                    new EncodableByteString(HUB_ROOM_ID_KEYWORD),
                [ObjectMetadataKeyEnumMap.DestinationDoorLabel]: new EncodableByteString(""),
                [ObjectMetadataKeyEnumMap.DoorType]:
                    new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
            });
        return this;
    }
}

// Hex colors for readability; encoding snaps them to the player palette (they're taken from it).
function playerColors(hexByPart: {[partName: string]: string})
{
    const colors: {[partName: string]: {x: number, y: number, z: number}} = {};
    for (const partName in hexByPart)
        colors[partName] = ColorUtil.hexToRGB(hexByPart[partName]);
    return colors;
}
