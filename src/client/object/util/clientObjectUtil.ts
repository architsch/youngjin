import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import Room from "../../../shared/room/types/room";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, PLAYER_HEIGHT, SINGLE_PLAYER_ENTRANCE_VOXEL_COL, SINGLE_PLAYER_ENTRANCE_VOXEL_ROW } from "../../../shared/system/sharedConstants";
import ClientObjectManager from "../clientObjectManager";
import ObjectFactory from "../factories/objectFactory";
import GameObject from "../types/gameObject";
import VoxelGameObject from "../types/voxelGameObject";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

const ClientObjectUtil =
{
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
    spawnEntranceDoor: async (room: Room): Promise<GameObject> =>
    {
        const gameObject = ObjectFactory.createClientSideObject(
            room.id,
            doorTypeIndex,
            new ObjectTransform(
                {x: MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: 0, z: MULTI_PLAYER_ENTRANCE_VOXEL_ROW},
                {x: 0, y: 0, z: -1}
            ),
        );
        await ClientObjectManager.addObject(gameObject, false, false);
        return gameObject;
    },
    spawnSingleModePlayer: async (room: Room): Promise<GameObject> =>
    {
        const gameObject = ObjectFactory.createClientSideObject(
            room.id,
            playerTypeIndex,
            new ObjectTransform(
                {x: SINGLE_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: 0.5 * PLAYER_HEIGHT, z: SINGLE_PLAYER_ENTRANCE_VOXEL_ROW + 0.5},
                {x: 0, y: 0, z: 1}
            ),
        );
        await ClientObjectManager.addObject(gameObject, false, false);
        return gameObject;
    },
}

export default ClientObjectUtil;