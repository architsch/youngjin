import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import Room from "../../../shared/room/types/room";
import RoomGenerationUtil from "../../../shared/room/generation/util/roomGenerationUtil";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../shared/system/sharedConstants";
import ClientObjectManager from "../clientObjectManager";
import ObjectFactory from "../factories/objectFactory";
import GameObject from "../types/gameObject/gameObject";
import VoxelGameObject from "../types/gameObject/voxelGameObject";

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

    // How many objects spawnVoxelsFromGrid spawns.
    getNumVoxelObjects: (): number =>
    {
        return Math.ceil(NUM_VOXEL_ROWS / VoxelGameObject.numVoxelsPerSide) *
            Math.ceil(NUM_VOXEL_COLS / VoxelGameObject.numVoxelsPerSide);
    },
    // One object for each patch of the floor plan (see VoxelGameObject), standing at its middle.
    spawnVoxelsFromGrid: async (room: Room): Promise<void> =>
    {
        const numVoxelsPerSide = VoxelGameObject.numVoxelsPerSide;
        for (let rowStart = 0; rowStart < NUM_VOXEL_ROWS; rowStart += numVoxelsPerSide)
        {
            for (let colStart = 0; colStart < NUM_VOXEL_COLS; colStart += numVoxelsPerSide)
            {
                const gameObject = ObjectFactory.createClientSideObject(
                    room.id,
                    voxelTypeIndex,
                    new ObjectTransform(
                        {x: (colStart + 0.5 * numVoxelsPerSide) * VOXEL_CELL_SIZE, y: 0,
                            z: (rowStart + 0.5 * numVoxelsPerSide) * VOXEL_CELL_SIZE},
                        {x: 0, y: 0, z: 1},
                        {...UNIT_VEC3}
                    )
                );
                (gameObject as VoxelGameObject).setVoxels(room.voxelGrid.voxels, rowStart, colStart);
                await ClientObjectManager.addObject(gameObject, false, false);
            }
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
        const {entrancePos} = config.getRoomBuilderParams();
        return {x: entrancePos.x, y: entrancePos.y + 0.5 * PLAYER_HEIGHT, z: entrancePos.z};
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