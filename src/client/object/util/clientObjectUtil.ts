import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import Room from "../../../shared/room/types/room";
import RoomGenerationUtil from "../../../shared/room/generation/util/roomGenerationUtil";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import ClientObjectManager from "../clientObjectManager";
import ObjectFactory from "../factories/objectFactory";
import GameObject from "../types/gameObject";
import VoxelGameObject from "../types/voxelGameObject";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

const ClientObjectUtil =
{
    // Room construction

    // Single-player rooms arrive empty (see Room.encode), so the client generates their content from
    // SinglePlayerModeConfig. Must run before anything reads room.voxelGrid / room.objectById.
    buildSinglePlayerRoomContent: (room: Room): void =>
    {
        RoomGenerationUtil.generateRoomContent(room);
        // buildRoom leaves roomID empty (only decodeWithParams stamps it), so backfill it.
        for (const obj of Object.values(room.objectById))
            obj.roomID = room.id;
    },

    // Spawn Actions

    spawnVoxelsFromGrid: async (room: Room): Promise<void> =>
    {
        for (const voxel of room.voxelGrid.voxels)
        {
            const gameObject = ObjectFactory.createClientSideObject(
                room.id,
                voxelTypeIndex,
                new ObjectTransform(
                    {x: voxel.col + 0.5, y: 0, z: voxel.row + 0.5},
                    {x: 0, y: 0, z: 1},
                    {...UNIT_VEC3}
                )
            );
            (gameObject as VoxelGameObject).setVoxel(voxel);
            await ClientObjectManager.addObject(gameObject, false, false);
        }
    },
    spawnSingleModePlayer: async (room: Room): Promise<GameObject> =>
    {
        const pos = ClientObjectUtil.getSingleModePlayerPosition(room);
        const gameObject = ObjectFactory.createClientSideObject(
            room.id,
            playerTypeIndex,
            new ObjectTransform(pos, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}),
            {}, "my_player"
        );
        // ObjectUpdateUtil resolves the player's setTransform through room.objectById.
        await ClientObjectManager.addObject(gameObject, false, true);
        return gameObject;
    },

    // Parameters

    getSingleModePlayerPosition: (room: Room): Vec3 =>
    {
        const config = SinglePlayerModeConfigMap[room.roomName];
        const p = config.getRoomBuilderParams();
        return {
            x: p.entranceVoxelCol + 0.5,
            y: 0.5 * PLAYER_HEIGHT + (p.entranceVoxelCollisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT,
            z: p.entranceVoxelRow + 0.5
        };
    },

    // Conditions

    playerIsInCircle: (circleCenterX: number, circleCenterZ: number, circleRadius: number): boolean =>
    {
        const myPlayer = ClientObjectManager.getMyPlayer();
        if (!myPlayer)
            return false;
        const dx = circleCenterX - myPlayer.position.x;
        const dz = circleCenterZ - myPlayer.position.z;
        const distSqr = dx*dx + dz*dz;
        return distSqr <= circleRadius*circleRadius;
    },
}

export default ClientObjectUtil;