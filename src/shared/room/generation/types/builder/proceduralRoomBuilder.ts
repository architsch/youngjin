import RoomVolumeUtil from "../../util/roomVolumeUtil";
import Room from "../../../types/room";
import RoomBuilderParams from "../params/roomBuilderParams";
import RoomPalette from "../roomPalette";
import RoomVolume from "../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../roomVolumeType";
import RoomAreaAllocator from "./helpers/roomAreaAllocator";
import RoomAreaConnector from "./helpers/roomAreaConnector";
import RoomPaletteSelector from "./helpers/roomPaletteSelector";
import RoomPropPlacer from "./helpers/roomPropPlacer";
import RoomStaircasePlanner from "./helpers/roomStaircasePlanner";
import RoomBuilder from "./roomBuilder";

// Here is the overall idea behind the procedural room generation logic:
//
// A room begins as one solid chunk of matter, and everything in it is carved out of that chunk.
// First, areas are allocated in random places and then grown, while making sure that their
// boundaries never touch each other - so that at least one block of wall always stands between any
// two of them. Grown far enough, these become the distinct spaces a room is made of: the lounge,
// the side rooms, the galleries above them.
//
// Because growth stops a block short of contact, any two neighbouring areas end up separated by
// exactly one block of wall, which is precisely where a passage can be cut. Passages are then made
// between pairs of them until every area is reachable from every other, directly or indirectly.
// Where an area has a storey above it, a flight of steps is carved up through the slab dividing
// them, so that the upper storey is somewhere the player can walk to rather than only see.
//
// Only once every volume is settled is any of it applied to the voxel grid. Carving is
// order-independent (see RoomVolumeUtil), so nothing here has to think about which volume goes
// first. The room is then furnished with block work, working off the built room rather than off
// the plan, because whether there is anything at a given place to stand something on is a question
// only the finished room can answer.
//
// (Important notes):
// 1. ProceduralRoomBuilder is meant to be a generic toolset for many different types of procedural
//      room generation, not just for a single pattern such as the one used for the Hub, a Regular
//      room, etc. A specific type of procedural generation should be conducted by
//      ProceduralRoomBuilder's child classes (such as HubRoomBuilder, RegularRoomBuilder, etc);
//      the role of ProceduralRoomBuilder is to simply provide a set of generic/reusable pieces of
//      logic. It owns the plan and the order the pieces run in, and no more than that: each piece
//      of the work itself belongs to one of the helpers under ./helpers.
// 2. Generation places no objects at all. Since a Hub or Regular room is meant to be furnished by
//      users, its areas are initialized as empty (except for purely voxel-based props) and the
//      user places objects in them later on.
// 3. Later on, we may be implementing new types of RoomBuilders for new types of single-player game
//      modes, such as a dungeon crawl, maze escape, treasure hunt, and so on. Their unique gameplay
//      levels (rooms), too, can be built using child classes of ProceduralRoomBuilder.

// How the plan is applied to the grid. Everything a room is described by is a volume, and what
// happens to one is decided entirely by what it is for: a space is taken out of the matter, block
// work is stood back up in it, and a reserved stretch is neither - it is only somewhere nothing
// generation places may go.
const HOLLOWED_VOLUME_TYPES = [
    RoomVolumeTypeEnumMap.Area,
    RoomVolumeTypeEnumMap.Passage,
    RoomVolumeTypeEnumMap.Stairwell,
    RoomVolumeTypeEnumMap.Entrance,
];
const RAISED_VOLUME_TYPES = [
    RoomVolumeTypeEnumMap.Step,
];

export default abstract class ProceduralRoomBuilder extends RoomBuilder
{
    // Everything the room is planned as, gathered under what each volume is for. Nothing is written
    // to the grid until carveOutRoom applies this, since a passage can only be worked out once the
    // areas have stopped growing, and a flight of steps only once there is a storey to climb to.
    protected volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]} = {};

    protected palettes = new RoomPaletteSelector();
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

    // The room's texture pack, drawn together with the palettes picked against it. This comes
    // before anything else a procedural room does, since every volume it goes on to plan is
    // finished in one of those palettes.
    protected initPalettes(): this
    {
        const texturePackPath = this.palettes.pickTexturePack(this.params.rand);
        this.room.texturePackPath = texturePackPath;
        this.params.texturePackPath = texturePackPath;
        return this;
    }

    protected nextPalette(): RoomPalette
    {
        return this.palettes.next();
    }

    // Records a volume the builder has shaped itself: the way into the room, a stretch of it to be
    // kept clear. What is done with it is decided by the type it is filed under.
    protected addVolume(roomVolumeType: RoomVolumeType, volume: RoomVolume): this
    {
        this.volumesByType[roomVolumeType].push(volume);
        return this;
    }

    // An area the builder has shaped itself - the one an entrance opens onto, the open middle a
    // room is arranged around - placed on the same terms as any the room draws for itself.
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

    // Areas shaped to hold a flight of steps, asked for before the rest are scattered - a room that
    // wants to be climbable needs somewhere long and narrow, and there is only room for something
    // that shape while the room is still mostly empty.
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

    // Applies the plan to the grid: everything to be hollow is taken out of the matter, and then
    // the block work the room is left standing on is raised back into it. The two halves are one
    // step because a stairwell without its steps is a hole rather than a way up.
    //
    // Order does not matter within either half - both settle which faces are drawn from what is
    // actually solid once they have finished (see RoomVolumeUtil) - but the halves are ordered with
    // respect to each other, since carving can only ever take matter away.
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
