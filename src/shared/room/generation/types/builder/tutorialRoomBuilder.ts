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
import { LABEL_COLOR_PALETTE_NAME } from "../../../../system/sharedConstants";

// What the tutorial's two fixtures look like is settled here rather than derived, because the
// tutorial is the first thing anybody sees of the game and it should be the same first thing every
// time. Elsewhere an object nobody has dressed falls back on an appearance seeded from where it
// stands, which is deterministic but nobody's choice: it is only asked to look like *a* door or *a*
// character, since it is a room's own people who will dress it afterwards. Nobody is going to dress
// these two, and a screenshot of the tutorial should keep matching the tutorial.
const RECEPTIONIST_APPEARANCE = CompositionMetadataUtil.encode(
    InstancedMeshCompositionCodecTypeEnumMap.Player, 0,
    {
        // The plainest build of every part but the hat, which is the round one with a brim — the one
        // thing on him that says he is standing there in a job rather than as another visitor.
        types: {head: 0, ear: 0, hat: 1, torso: 0, arm: 0, bottom: 0},
        colors: playerColors({
            head: "#c6b492", ear: "#c6b492", hat: "#95002d",
            torso: "#95002d", arm: "#95002d", bottom: "#2a2a2a",
        }),
    });

// Pine, with a putty plate and a brass knob: the friendliest of the finishes a door can be given,
// and the one that shows a door's grain and joinery most plainly of them all.
const TUTORIAL_DOOR_COLOR_SCHEME_INDEX = 0;

const TUTORIAL_DOOR_APPEARANCE = CompositionMetadataUtil.encode(
    InstancedMeshCompositionCodecTypeEnumMap.Door, 0,
    {colors: DoorCompositionConstants.colorSchemes[TUTORIAL_DOOR_COLOR_SCHEME_INDEX]});

// A dark grey that reads as lettering on the plate without going to flat black, snapped to the
// nearest position the lettering palette holds.
const TUTORIAL_DOOR_LABEL_COLOR_INDEX = ColorUtil.rgbToPaletteIndex(
    LABEL_COLOR_PALETTE_NAME, ColorUtil.hexToRGB("#33302c"));

// The tutorial's room: four small spaces the player is walked through in turn, each finished in a
// palette of its own so that moving from one to the next is visible as such, plus the two fixtures
// the tutorial's steps address by name.
//
// The stretches of wall between the spaces are deliberately left uncarved. They are mass like the
// rest of the room until a scripted step opens one up and sends the player on.
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

        // Add the door. It is the room's own way in, and it is deliberately wired to nowhere: a
        // default entrance leading nowhere takes whoever walks through it out to wherever the server
        // judges he should go next, which is exactly what leaving the tutorial means.
        room.objectGroup.objectById["door"] = new AddObjectSignal("", "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), "door",
            new ObjectTransform(params.hotspots.door, {x: 0, y: 0, z: 1}),
            {
                [ObjectMetadataKeyEnumMap.InstancedMeshComposition]:
                    new EncodableByteString(TUTORIAL_DOOR_APPEARANCE),
                [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Door"),
                [ObjectMetadataKeyEnumMap.LabelColor]:
                    new EncodableByteString(`${TUTORIAL_DOOR_LABEL_COLOR_INDEX}`),
                [ObjectMetadataKeyEnumMap.DestinationRoomId]: new EncodableByteString(""),
                [ObjectMetadataKeyEnumMap.DestinationDoorLabel]: new EncodableByteString(""),
                [ObjectMetadataKeyEnumMap.DoorType]:
                    new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
            });
        return this;
    }
}

// The character's colors, written as hexes for the sake of reading them. Encoding snaps each to the
// nearest position the palette a character is painted from holds, so these are named from that
// palette to begin with and nothing is lost on the way down.
function playerColors(hexByPart: {[partName: string]: string})
{
    const colors: {[partName: string]: {x: number, y: number, z: number}} = {};
    for (const partName in hexByPart)
        colors[partName] = ColorUtil.hexToRGB(hexByPart[partName]);
    return colors;
}
