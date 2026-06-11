import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import Room from "../../../shared/room/types/room";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, PLAYER_HEIGHT } from "../../../shared/system/sharedConstants";
import ClientObjectManager from "../clientObjectManager";
import ObjectFactory from "../factories/objectFactory";
import GameObject from "../types/gameObject";
import VoxelGameObject from "../types/voxelGameObject";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

const ClientObjectUtil =
{
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
                    {x: 0, y: 0, z: 1}
                )
            );
            (gameObject as VoxelGameObject).setVoxel(voxel);
            await ClientObjectManager.addObject(gameObject, false, false);
        }
    },
    spawnMultiplayerEntranceDoor: async (room: Room): Promise<GameObject> =>
    {
        const gameObject = ObjectFactory.createClientSideObject(
            room.id,
            doorTypeIndex,
            new ObjectTransform(
                {x: MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: 0, z: MULTI_PLAYER_ENTRANCE_VOXEL_ROW},
                {x: 0, y: 0, z: -1}
            )
        );
        await ClientObjectManager.addObject(gameObject, false, false);
        return gameObject;
    },
    spawnSingleModePlayer: async (room: Room): Promise<GameObject> =>
    {
        const pos = ClientObjectUtil.getSingleModePlayerPosition(room);
        const gameObject = ObjectFactory.createClientSideObject(
            room.id,
            playerTypeIndex,
            new ObjectTransform(pos, {x: 0, y: 0, z: 1}),
            {}, "my_player"
        );
        // The player must be registered to the client-side room's objectById because
        // ObjectUpdateUtil processes the player rigidbody's "setTransform" call
        // through its corresponding entry in room.objectById.
        await ClientObjectManager.addObject(gameObject, false, true);
        return gameObject;
    },

    // Parameters

    getSingleModePlayerPosition: (room: Room): Vec3 =>
    {
        const config = SinglePlayerModeConfigMap[room.roomName];
        const metadata = config.loadMetadata();
        return {x: metadata.entranceVoxelCol + 0.5, y: 0.5 * PLAYER_HEIGHT, z: metadata.entranceVoxelRow + 0.5};
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