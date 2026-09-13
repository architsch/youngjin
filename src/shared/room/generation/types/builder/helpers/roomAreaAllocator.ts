import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import { RoomVolumeConstructorMap } from "../../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";
import RoomPaletteSelector from "./roomPaletteSelector";

// Places room areas: scatter small footprints, then grow each a block at a time while it doesn't touch
// another, so neighbours end up exactly one wall block apart (where passages get cut). Candidates that
// don't fit are dropped.

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

    // Adds a caller-shaped area (e.g. the entrance area); returns whether it fits.
    add(volume: RoomVolume): boolean
    {
        if (!this.areaFits(volume))
            return false;
        if (!volume.palette)
            volume.palette = this.palettes.next();
        this.getAreas().push(volume);
        return true;
    }

    // Inside the boundary and not touching placed areas. `ignore` excludes the area being grown.
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

    // Scatters footprints of an exact long, narrow shape (e.g. for stairs). Call before the general
    // scatter, while space remains.
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

    // Grows all areas round by round in random directions, so no single area swallows the room.
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
