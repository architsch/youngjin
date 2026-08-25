import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import { RoomVolumeConstructorMap } from "../../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";
import RoomPaletteSelector from "./roomPaletteSelector";

//------------------------------------------------------------------------
// Decides where the areas a room is made of stand, and how big they get.
//
// Areas begin as small footprints scattered over the room, and are then
// grown outwards a block at a time for as long as they can grow without
// touching one another. That last condition is what the whole layout
// rests on: because growth stops a block short of contact, any two
// neighbouring areas end up separated by exactly one block of wall -
// which is precisely where a passage can later be cut. So the room comes
// out as distinct spaces with real walls between them rather than as one
// merged blob, and nothing has to arrange that afterwards.
//
// A candidate that does not fit is simply dropped. How many areas a room
// ends up with is a consequence of how much room was left for them,
// rather than something to force.
//------------------------------------------------------------------------

export default class RoomAreaAllocator
{
    private rand: RandomNumberGenerator;
    private volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]};
    private palettes: RoomPaletteSelector;

    constructor(rand: RandomNumberGenerator,
        volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]},
        palettes: RoomPaletteSelector)
    {
        this.rand = rand;
        this.volumesByType = volumesByType;
        this.palettes = palettes;
    }

    // Takes an area the caller has shaped itself - the one an entrance opens onto, the open middle
    // a room is arranged around - on the same terms as any other. Answers whether it fitted.
    add(volume: RoomVolume): boolean
    {
        if (!this.areaFits(volume))
            return false;
        if (!volume.palette)
            volume.palette = this.palettes.next();
        this.getAreas().push(volume);
        return true;
    }

    // Whether an area may stand here: inside the room's boundary, and not touching anything already
    // placed. `ignore` is for testing a grown copy of an area that is already placed.
    areaFits(volume: RoomVolume, ignore?: RoomVolume): boolean
    {
        return RoomVolumeUtil.volumeFitsAmong(volume, RoomVolumeConstructorMap["Interior"](),
            this.getAreas(), ignore);
    }

    // Scatters footprints of a random size over the room, on one of the given storeys.
    scatter(attempts: number, minSpan: number, maxSpan: number, storeyShapes: string[]): void
    {
        for (let attempt = 0; attempt < attempts; ++attempt)
        {
            this.tryFootprintSomewhere(this.rand.randomInt(minSpan, maxSpan + 1),
                this.rand.randomInt(minSpan, maxSpan + 1), storeyShapes);
        }
    }

    // Scatters footprints of one exact shape, laid whichever way round the draw says. This is for
    // an area that has to be able to hold something long and narrow - a flight of steps above all.
    // A footprint drawn at random is unlikely to come out either long or narrow, so a room that
    // wants one asks for it before it scatters the rest, while there is still room for something
    // this shape. Growth widens it from there like any other area.
    scatterWithFootprint(attempts: number, longSide: number, shortSide: number,
        storeyShapes: string[]): void
    {
        for (let attempt = 0; attempt < attempts; ++attempt)
        {
            const alongRows = this.rand.randomInt(0, 2) == 0;
            this.tryFootprintSomewhere(alongRows ? longSide : shortSide,
                alongRows ? shortSide : longSide, storeyShapes);
        }
    }

    // Grows every area outwards a block at a time, in a random direction, for as long as it can do
    // so without touching another. Growing them all together round by round, rather than one after
    // another, keeps a single area from swallowing the room before the rest have started.
    grow(rounds: number): void
    {
        for (let round = 0; round < rounds; ++round)
        {
            for (const volume of this.getAreas())
            {
                const grown = expandOneSide(volume, this.rand.randomInt(0, 4));
                if (!this.areaFits(grown, volume))
                    continue;
                volume.rowMin = grown.rowMin;
                volume.rowMax = grown.rowMax;
                volume.colMin = grown.colMin;
                volume.colMax = grown.colMax;
            }
        }
    }

    //--------------------------------------------------------------------------------------------

    private getAreas(): RoomVolume[]
    {
        return this.volumesByType[RoomVolumeTypeEnumMap.Area];
    }

    private tryFootprintSomewhere(numRows: number, numCols: number, storeyShapes: string[]): boolean
    {
        const interior = RoomVolumeConstructorMap["Interior"]();
        const rowMin = this.rand.randomInt(interior.rowMin, interior.rowMax - numRows + 2);
        const colMin = this.rand.randomInt(interior.colMin, interior.colMax - numCols + 2);

        return this.add(RoomVolumeConstructorMap[this.rand.pick(storeyShapes)](
            rowMin, rowMin + numRows - 1, colMin, colMin + numCols - 1, this.palettes.next()));
    }
}

// The same volume with one of its four sides pushed out by a block.
function expandOneSide(volume: RoomVolume, side: number): RoomVolume
{
    const grown = RoomVolumeUtil.getExpandedVolume(volume, 0);
    switch (side)
    {
        case 0: --grown.rowMin; break;
        case 1: ++grown.rowMax; break;
        case 2: --grown.colMin; break;
        default: ++grown.colMax; break;
    }
    return grown;
}
