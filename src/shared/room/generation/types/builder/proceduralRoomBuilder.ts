import RoomVolumeUtil from "../../util/roomVolumeUtil";
import Room from "../../../types/room";
import RoomBuilderParams from "../params/roomBuilderParams";
import RoomVolume from "../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../roomVolumeType";
import RoomAreaAllocator from "./helpers/roomAreaAllocator";
import RoomAreaConnector from "./helpers/roomAreaConnector";
import RoomPropPlacer from "./helpers/roomPropPlacer";
import RoomStaircasePlanner from "./helpers/roomStaircasePlanner";
import RoomBuilder from "./roomBuilder";

// Generic procedural toolkit (see @docs/geometry/room_generation.md). The room starts solid; areas are
// scattered and grown one wall block apart, passages connect them, and stairwells reach upper storeys.
// The plan is applied to the grid only once settled (carving is order-independent), then block work is
// added based on the carved room. Specific room types are subclasses (HubRoomBuilder,
// RegularRoomBuilder, ...); this class owns the plan and pass order, and the work lives in ./helpers.
// No objects are placed here (rooms are furnished by users).

// How each volume type is applied: hollowed, filled, or reserved (neither).
const HOLLOWED_VOLUME_TYPES = [
    RoomVolumeTypeEnumMap.Area,
    RoomVolumeTypeEnumMap.Passage,
    RoomVolumeTypeEnumMap.Stairwell,
];
const RAISED_VOLUME_TYPES = [
    RoomVolumeTypeEnumMap.Step,
];

export default abstract class ProceduralRoomBuilder extends RoomBuilder
{
    // The plan, by volume type. Applied only in carveOutRoom, since passages and stairs depend on the
    // finished areas.
    protected volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]} = {};

    private areas: RoomAreaAllocator;
    private connector: RoomAreaConnector;
    private staircases: RoomStaircasePlanner;
    private props: RoomPropPlacer;

    constructor(params: RoomBuilderParams, room: Room)
    {
        super(params, room);

        for (const roomVolumeType of Object.keys(RoomVolumeTypeEnumMap))
            this.volumesByType[RoomVolumeTypeEnumMap[roomVolumeType]] = [];

        this.areas = new RoomAreaAllocator(params.rand, this.volumesByType, this.palettes);
        this.connector = new RoomAreaConnector(this.volumesByType);
        this.staircases = new RoomStaircasePlanner(params.rand, this.volumesByType, this.areas);
        this.props = new RoomPropPlacer(params.rand, this.volumesByType);
    }

    // Records a caller-shaped volume (e.g. entrance, keep-clear stretch) under a type.
    protected addVolume(roomVolumeType: RoomVolumeType, volume: RoomVolume): this
    {
        this.volumesByType[roomVolumeType].push(volume);
        return this;
    }

    // A caller-shaped area (e.g. the entrance area) placed like any drawn one.
    protected addArea(volume: RoomVolume): boolean
    {
        return this.areas.add(volume);
    }

    protected allocateAreas(attempts: number, minSpan: number, maxSpan: number,
        storeyShapes: string[]): this
    {
        this.areas.scatter(attempts, minSpan, maxSpan, storeyShapes);
        return this;
    }

    // Stair-capable (long, narrow) areas, requested before general scattering while space remains.
    protected allocateStaircaseCapableAreas(attempts: number, storeyShapes: string[]): this
    {
        this.areas.scatterWithFootprint(attempts, RoomStaircasePlanner.MIN_AREA_RUN,
            RoomStaircasePlanner.MIN_AREA_WIDTH, storeyShapes);
        return this;
    }

    protected growAreas(rounds: number): this
    {
        this.areas.grow(rounds);
        return this;
    }

    protected raiseSecondStoreys(chance: number, atLeastOne: boolean = false): this
    {
        this.staircases.raiseSecondStoreys(chance, atLeastOne);
        return this;
    }

    protected connectAreas(): this
    {
        this.connector.connect();
        return this;
    }

    // Applies the plan: hollow volumes, then fill block work (stair steps, props). Order within each
    // half doesn't matter (see RoomVolumeUtil), but carving must precede filling.
    protected carveOutRoom(): this
    {
        const voxels = this.room.voxelGrid.voxels;
        for (const roomVolumeType of HOLLOWED_VOLUME_TYPES)
        {
            for (const volume of this.volumesByType[roomVolumeType])
                RoomVolumeUtil.carveOutVolume(voxels, volume);
        }
        for (const roomVolumeType of RAISED_VOLUME_TYPES)
        {
            for (const volume of this.volumesByType[roomVolumeType])
                RoomVolumeUtil.fillVolume(voxels, volume);
        }
        return this;
    }

    protected placeProps(chancePerCell: number, maxStackHeight: number): this
    {
        this.props.place(this.room.voxelGrid.voxels, chancePerCell, maxStackHeight);
        return this;
    }
}
