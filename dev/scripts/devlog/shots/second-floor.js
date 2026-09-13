// Shots for the "second floor" post: a two-storey room, its staircase, and the view down from the upper
// floor. Everything is derived from the grid, not fixed coordinates: standable cells on the lowest layer
// are the ground floor, on the middle layer the upper floor, and in between are stair treads. A gallery
// edge is an upper-floor cell beside floor below with nothing above. First person pitches down over
// drops, so frames include the near floor edge.

const GROUND_LAYER = 0;
const UPPER_LAYER = 8;            // Where the storey floor puts the upper storey's standing height.
const ALL_SPOTS = 4000;           // More than a room has, so the whole grid comes back.

const EDIT_SWING_DEG = -110;
const EDIT_ZOOM = 0.7;

// Flights worth trying, and how far from a flight's foot to look for a standing spot.
const VIEWABLE_FLIGHTS = 4;
const STAIRS_CANDIDATES = 10;
const MIN_STAIRS_DISTANCE = 2.5;
const MAX_STAIRS_DISTANCE = 7;

// Gallery edges to try, and the open floor required beyond one.
const GALLERY_CANDIDATES = 12;
const MIN_GALLERY_DEPTH = 3;
const MAX_GALLERY_DEPTH = 12;

const key = (spot) => `${spot.row},${spot.col}`;

module.exports = {
    slug: "second-floor",

    // A generated room (the post is about the game itself), seeded and removed afterwards.
    freshRoom: true,

    devUser: 1,
    startPath: "/",
    tutorial: false,
    // Only hubs have two storeys (Regular rooms have one; see RegularRoomBuilder).
    roomType: "hub",
    async run(ctx)
    {
        const { shot, sleep, clickId, setup, interact, log } = ctx;

        const spots = await setup.standingSpots({ limit: ALL_SPOTS });
        const ground = spots.filter(s => s.collisionLayer == GROUND_LAYER);
        const upper = spots.filter(s => s.collisionLayer == UPPER_LAYER);
        const treads = spots.filter(s => s.collisionLayer > GROUND_LAYER && s.collisionLayer < UPPER_LAYER);
        log(`${ground.length} places on the ground floor, ${upper.length} above, ` +
            `${treads.length} on the stairs`);

        if (upper.length == 0)
        {
            throw new Error("This room has no upper storey to photograph. A Regular room is built " +
                "one storey tall on purpose, so this shot has to be taken in a hub — run with " +
                "--fresh-room, which honours this script's roomType.");
        }

        // --- The staircase, seen from the floor it starts on. ---
        // Treads are grouped into flights first; the room's lowest and highest treads may be different staircases.
        const flights = groupIntoFlights(treads);
        log(`${flights.length} flight(s) of steps`);

        // A flight is chosen together with a vantage (a stairwell may leave nowhere to stand), tallest first.
        let stairs = null;
        for (const flight of flights.slice(0, VIEWABLE_FLIGHTS))
        {
            stairs = await findStairsVantage(ctx, flight, ground);
            if (stairs != null)
                break;
        }

        if (stairs != null)
        {
            log(`stairs: from ${stairs.spot.x}, ${stairs.spot.z} up to ${stairs.head.x}, ` +
                `${stairs.head.z} (layer ${stairs.foot.collisionLayer} to ` +
                `${stairs.head.collisionLayer})`);
            await shot("stairs");
        }
        else
            log("WARNING: no flight of steps has anywhere clear to view it from");

        // --- The gallery: standing on the upper floor at the edge of the drop. ---
        // The grid can't tell a wall from an open drop, so each edge is verified by standing and looking.
        let gallery = null;
        for (const edge of findGalleryEdges(upper, ground).slice(0, GALLERY_CANDIDATES))
        {
            // Facing out over the drop, which is where the camera pitches down of its own accord.
            await setup.place(edge.spot.x, edge.spot.z, {
                collisionLayer: UPPER_LAYER,
                faceX: edge.spot.x + edge.dx * 4,
                faceZ: edge.spot.z + edge.dz * 4,
            });
            if (await looksDownOntoTheFloorBelow(ctx))
            {
                gallery = edge;
                break;
            }
        }

        if (gallery == null)
            throw new Error("This room's upper storey has no edge open over the floor below.");

        log(`gallery: at ${gallery.spot.x}, ${gallery.spot.z} looking out over ` +
            `${gallery.depth} cells of open floor below`);
        await shot("gallery");

        // --- Editing a block on the floor below, from the floor above it. ---
        // Aimed over the drop, where only the ground floor is in reach and nothing occludes it.
        const reached = await interact.clickSurfaceUntilEnabled("startEditingButton",
            { objectType: "Voxel" }).then(() => true, (err) => { log(`  ${err.message}`); return false; });

        if (reached)
        {
            await clickId("startEditingButton");
            await sleep(2000);
            if (await ctx.page.locator("#addVoxelBlockButton").first().isVisible().catch(() => false))
            {
                // Swing only: the orbit already looks down from the gallery, and lifting it ends up overhead.
                await setup.swing({ azimuthDeg: EDIT_SWING_DEG, zoom: EDIT_ZOOM });
                await shot("editing");
                await clickId("modeExitButton");
            }
            else
                log("WARNING: what was selected below offered no block tools");
        }
        else
            log("WARNING: could not reach a block on the floor below");

        log(`end: ${JSON.stringify(await setup.pose())}`);
    },
};

// Minimum clear view distance at frame center, telling a vantage from facing a wall.
const CLEAR_VIEW_DISTANCE = 3.5;

// How far below eye height a ray must land to hit the storey below rather than something on this one.
const DROP_BELOW_HEIGHT = 2.5;

/**
 * Stands the player where a flight is visible (ground cells a few paces off its foot, each verified by
 * looking) and returns the spot.
 */
async function findStairsVantage(ctx, flight, ground)
{
    const foot = flight[0];
    const head = flight[flight.length - 1];

    const candidates = ground
        .map(spot => ({spot, distance: Math.hypot(spot.x - foot.x, spot.z - foot.z)}))
        .filter(c => c.distance >= MIN_STAIRS_DISTANCE && c.distance <= MAX_STAIRS_DISTANCE)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, STAIRS_CANDIDATES);

    // Aimed at the flight's middle, which sits in front of the camera as the flight rises away.
    const middle = flight[Math.floor(flight.length / 2)];

    for (const {spot} of candidates)
    {
        await ctx.setup.place(spot.x, spot.z,
            { collisionLayer: GROUND_LAYER, faceX: middle.x, faceZ: middle.z });
        if (await hasOpenView(ctx))
            return {spot, foot, head};
    }
    return null;
}

async function probeAhead(ctx)
{
    const camera = await ctx.interact.call("camera");
    return ctx.interact.call("probe",
        camera.canvas.left + camera.canvas.width / 2,
        camera.canvas.top + camera.canvas.height / 2);
}

async function hasOpenView(ctx)
{
    const hit = await probeAhead(ctx);
    // Nothing hit at all is open air, which is a view; a hit close in is a wall in the face.
    return hit == null || hit.distance >= CLEAR_VIEW_DISTANCE;
}

/** Whether the view hits the storey below rather than a distant wall, told apart by hit height. */
async function looksDownOntoTheFloorBelow(ctx)
{
    const hit = await probeAhead(ctx);
    if (hit == null)
        return false; // Open sky, not open floor: nothing to look down onto.
    const pose = await ctx.setup.pose();
    return pose.y - hit.world.y >= DROP_BELOW_HEIGHT;
}

/**
 * Groups tread cells into flights (touching, within a step in height), ordered by height covered so the
 * first is the fullest climb.
 */
function groupIntoFlights(treads)
{
    const remaining = new Map(treads.map(tread => [key(tread), tread]));
    const flights = [];

    while (remaining.size > 0)
    {
        const [firstKey, first] = remaining.entries().next().value;
        remaining.delete(firstKey);

        const flight = [first];
        const pending = [first];
        while (pending.length > 0)
        {
            const tread = pending.pop();
            for (const [dRow, dCol] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            {
                const neighbourKey = `${tread.row + dRow},${tread.col + dCol}`;
                const neighbour = remaining.get(neighbourKey);
                if (neighbour == undefined)
                    continue;
                if (Math.abs(neighbour.collisionLayer - tread.collisionLayer) > 1)
                    continue; // Touching, but not a step apart: a different flight passing by.
                remaining.delete(neighbourKey);
                flight.push(neighbour);
                pending.push(neighbour);
            }
        }

        flight.sort((a, b) => a.collisionLayer - b.collisionLayer);
        flights.push(flight);
    }

    const rise = (flight) => flight[flight.length - 1].collisionLayer - flight[0].collisionLayer;
    flights.sort((a, b) => rise(b) - rise(a));
    return flights;
}


/**
 * Upper-storey cells beside possible open air (floor below, none at this height), longest run first. A
 * wall standing on the floor below looks the same in the grid, so these are candidates the caller verifies.
 */
function findGalleryEdges(upper, ground)
{
    const upperCells = new Set(upper.map(key));
    const groundCells = new Set(ground.map(key));
    const directions = [{dx: 1, dz: 0}, {dx: -1, dz: 0}, {dx: 0, dz: 1}, {dx: 0, dz: -1}];

    const edges = [];
    for (const spot of upper)
    {
        for (const direction of directions)
        {
            let depth = 0;
            while (depth < MAX_GALLERY_DEPTH)
            {
                const cell = `${spot.row + direction.dz * (depth + 1)},` +
                    `${spot.col + direction.dx * (depth + 1)}`;
                if (upperCells.has(cell) || !groundCells.has(cell))
                    break;
                ++depth;
            }
            if (depth >= MIN_GALLERY_DEPTH)
                edges.push({ spot, dx: direction.dx, dz: direction.dz, depth });
        }
    }
    edges.sort((a, b) => b.depth - a.depth);
    return edges;
}
