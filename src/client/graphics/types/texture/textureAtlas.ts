import TextureAtlasAllocator from "./textureAtlasAllocator";
import TextureAtlasRegion from "./textureAtlasRegion";
import TextureAtlasHolder from "./textureAtlasHolder";
import TextureAtlasDraw from "./textureAtlasDraw";
import TextureAtlasEntry from "./textureAtlasEntry";

// Content shared by key in one atlas texture. Each key's content is drawn once, into a region of whole cells
// (see TextureAtlasAllocator) as large as the largest of its holders asks for; the drawing is the owner's
// (see TextureAtlasDraw). An entry that moves is drawn in its new region before its holders are told, so they
// never show a region still being drawn. Holders' callbacks must not call back into the atlas.
export default class TextureAtlas
{
    private readonly name: string; // for logs
    private readonly allocator: TextureAtlasAllocator;
    // A region that finds no room is shrunk to half its size (down to one cell) before anything is repacked,
    // so all content is shown, some of it at a lower resolution.
    private readonly shrinkWhenFull: boolean;
    // No region is given more cells than this on either side, whatever its holders ask for.
    private readonly maxRegionSide: number;
    private readonly entries = new Map<string, TextureAtlasEntry>();

    constructor(name: string, numCols: number, numRows: number,
        options: {shrinkWhenFull?: boolean, maxRegionSide?: number} = {})
    {
        this.name = name;
        this.allocator = new TextureAtlasAllocator(numCols, numRows);
        this.shrinkWhenFull = options.shrinkWhenFull ?? false;
        this.maxRegionSide = options.maxRegionSide ?? Infinity;
    }

    // Takes hold of key's content, or changes the size this holder asks for (capped, keeping its shape, at
    // the atlas's largest region). A new holder of content that is already drawn is told its region at once.
    acquire(key: string, holder: TextureAtlasHolder, numCols: number, numRows: number,
        draw: TextureAtlasDraw): void
    {
        let entry = this.entries.get(key);
        if (entry == undefined)
        {
            entry = {key, draw, sizeByHolder: new Map(), region: undefined, pendingRegion: undefined,
                allocatedFor: undefined, drawGeneration: 0};
            this.entries.set(key, entry);
        }
        entry.draw = draw;
        const isNewHolder = !entry.sizeByHolder.has(holder);
        entry.sizeByHolder.set(holder, capSize({numCols: Math.max(1, numCols), numRows: Math.max(1, numRows)},
            this.maxRegionSide));

        const regionBefore = entry.region;
        this.fit(entry);
        // Every holder was told already if the entry just moved.
        if (isNewHolder && entry.region != undefined && entry.region === regionBefore)
            holder.onAtlasRegionChanged(entry.region);
    }

    release(key: string, holder: TextureAtlasHolder): void
    {
        const entry = this.entries.get(key);
        if (entry == undefined || !entry.sizeByHolder.delete(holder))
            return;
        if (entry.sizeByHolder.size > 0)
        {
            this.fit(entry);
            return;
        }
        this.entries.delete(key);
        this.freePendingRegion(entry);
        if (entry.region != undefined)
            this.allocator.free(entry.region);
        entry.region = undefined;
        this.restoreShrunkEntries();
    }

    // Redraws key's content where it is (e.g. a label's new text).
    invalidate(key: string): void
    {
        const entry = this.entries.get(key);
        if (entry != undefined)
            this.startDraw(entry);
    }

    // For when the texture's contents were lost, not replaced (a graphics context restore).
    redrawAll(): void
    {
        this.entries.forEach(entry => this.startDraw(entry));
    }

    // Where key's content is drawn, if anywhere yet.
    getRegion(key: string): TextureAtlasRegion | undefined
    {
        return this.entries.get(key)?.region;
    }

    getNumFreeCells(): number
    {
        return this.allocator.getNumFreeCells();
    }

    // Moves the entry to a region of the size its holders now ask for, unless it has one of that size.
    private fit(entry: TextureAtlasEntry): void
    {
        const wanted = getWantedSize(entry);
        if (entry.allocatedFor != undefined && entry.allocatedFor.numCols == wanted.numCols
            && entry.allocatedFor.numRows == wanted.numRows)
            return;

        this.freePendingRegion(entry);
        let region = this.allocator.allocate(wanted.numCols, wanted.numRows);
        // No room beside the old region: it goes first, and the holders show nothing until the redraw lands.
        if (region == undefined && entry.region != undefined)
        {
            this.allocator.free(entry.region);
            this.setRegion(entry, undefined);
            region = this.allocator.allocate(wanted.numCols, wanted.numRows);
        }
        region ??= this.allocateShrunk(wanted);
        if (region == undefined)
        {
            this.repack();
            return;
        }
        entry.allocatedFor = wanted;
        entry.pendingRegion = region;
        this.startDraw(entry);
    }

    // Halving from half the size down to one cell, if this atlas shrinks what doesn't fit.
    private allocateShrunk(size: {numCols: number, numRows: number}): TextureAtlasRegion | undefined
    {
        let numCols = size.numCols;
        let numRows = size.numRows;
        while (this.shrinkWhenFull && (numCols > 1 || numRows > 1))
        {
            numCols = Math.ceil(numCols / 2);
            numRows = Math.ceil(numRows / 2);
            const region = this.allocator.allocate(numCols, numRows);
            if (region != undefined)
                return region;
        }
        return undefined;
    }

    // Only reached when fragmentation leaves no room (or, when shrinking, not even one cell): every entry is
    // packed again from scratch, largest first, and redrawn where it lands. When shrinking, the largest are
    // capped a cell smaller at a time until everything fits, rather than the first come keeping theirs.
    private repack(): void
    {
        console.warn(`TextureAtlas :: ${this.name} is fragmented, so everything in it is being packed again`);
        const entries = [...this.entries.values()]
            .sort((a, b) => getArea(getWantedSize(b)) - getArea(getWantedSize(a)));
        let maxSide = Math.max(1, ...entries.map(entry => {
            const size = getWantedSize(entry);
            return Math.max(size.numCols, size.numRows);
        }));
        let regions: (TextureAtlasRegion | undefined)[];
        while (true)
        {
            this.allocator.clear();
            regions = entries.map(entry => {
                const size = capSize(getWantedSize(entry), maxSide);
                return this.allocator.allocate(size.numCols, size.numRows);
            });
            if (!this.shrinkWhenFull || maxSide == 1 || regions.every(region => region != undefined))
                break;
            --maxSide;
        }

        for (const entry of entries)
        {
            entry.pendingRegion = undefined;
            ++entry.drawGeneration;
            if (entry.region != undefined)
                this.setRegion(entry, undefined);
        }
        entries.forEach((entry, i) => {
            entry.allocatedFor = getWantedSize(entry);
            entry.pendingRegion = regions[i];
            if (entry.pendingRegion == undefined)
                console.warn(`TextureAtlas :: No room in ${this.name} (key = ${entry.key})`);
            else
                this.startDraw(entry);
        });
    }

    // Cells were freed: an entry shrunk (or left out) for want of room tries for its full size again.
    private restoreShrunkEntries(): void
    {
        for (const entry of this.entries.values())
        {
            const wanted = entry.allocatedFor;
            const current = entry.pendingRegion ?? entry.region;
            if (wanted == undefined || (current != undefined
                && current.numCols >= wanted.numCols && current.numRows >= wanted.numRows))
                continue;
            const region = this.allocator.allocate(wanted.numCols, wanted.numRows);
            if (region == undefined)
                continue;
            this.freePendingRegion(entry);
            entry.pendingRegion = region;
            this.startDraw(entry);
        }
    }

    // Into the region being drawn if there is one, else where the entry is.
    private startDraw(entry: TextureAtlasEntry): void
    {
        const target = entry.pendingRegion ?? entry.region;
        if (target == undefined)
            return;
        const generation = ++entry.drawGeneration;
        const isCurrent = () => entry.drawGeneration == generation && this.entries.get(entry.key) === entry;

        let drawn: void | Promise<void> = undefined;
        try
        {
            drawn = entry.draw(target, isCurrent);
        }
        catch (err)
        {
            console.error(`TextureAtlas :: Failed to draw into ${this.name} (key = ${entry.key}): ${err}`);
        }
        if (drawn instanceof Promise)
        {
            drawn.catch(err => console.error(`TextureAtlas :: Failed to draw into ${this.name} (key = ${entry.key}): ${err}`))
                .then(() => this.onDrawn(entry, isCurrent));
        }
        else
        {
            this.onDrawn(entry, isCurrent);
        }
    }

    // Moves the holders onto the region just drawn, unless a later draw or a release superseded it.
    private onDrawn(entry: TextureAtlasEntry, isCurrent: () => boolean): void
    {
        if (!isCurrent() || entry.pendingRegion == undefined)
            return;
        if (entry.region != undefined)
            this.allocator.free(entry.region);
        const region = entry.pendingRegion;
        entry.pendingRegion = undefined;
        this.setRegion(entry, region);
    }

    // A draw still in flight for it is dropped.
    private freePendingRegion(entry: TextureAtlasEntry): void
    {
        if (entry.pendingRegion == undefined)
            return;
        this.allocator.free(entry.pendingRegion);
        entry.pendingRegion = undefined;
        ++entry.drawGeneration;
    }

    private setRegion(entry: TextureAtlasEntry, region: TextureAtlasRegion | undefined): void
    {
        entry.region = region;
        entry.sizeByHolder.forEach((_size, holder) => holder.onAtlasRegionChanged(region));
    }
}

function getWantedSize(entry: TextureAtlasEntry): {numCols: number, numRows: number}
{
    let numCols = 1;
    let numRows = 1;
    entry.sizeByHolder.forEach(size => {
        numCols = Math.max(numCols, size.numCols);
        numRows = Math.max(numRows, size.numRows);
    });
    return {numCols, numRows};
}

// Scaled down, keeping its shape as nearly as whole cells allow, until no side is longer than maxSide.
function capSize(size: {numCols: number, numRows: number}, maxSide: number): {numCols: number, numRows: number}
{
    const scale = maxSide / Math.max(size.numCols, size.numRows);
    if (scale >= 1)
        return size;
    return {
        numCols: Math.min(maxSide, Math.max(1, Math.ceil(size.numCols * scale))),
        numRows: Math.min(maxSide, Math.max(1, Math.ceil(size.numRows * scale))),
    };
}

function getArea(size: {numCols: number, numRows: number}): number
{
    return size.numCols * size.numRows;
}
