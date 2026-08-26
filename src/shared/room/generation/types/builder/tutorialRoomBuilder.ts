import RoomBuilder from "./roomBuilder";
import AddObjectSignal from "../../../../object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../../object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../../object/types/objectTransform";
import RoomVolumeUtil from "../../util/roomVolumeUtil";

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
            new ObjectTransform(params.hotspots.npc, {x: 1, y: 0, z: 0}));

        // Add the door.
        room.objectGroup.objectById["door"] = new AddObjectSignal("", "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), "door",
            new ObjectTransform(params.hotspots.door, {x: 0, y: 0, z: 1}));
        return this;
    }
}
