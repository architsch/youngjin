// Shots for the "second floor" post: a room that stands two storeys tall, the staircase that joins
// them, and what the upper floor looks down on.
//
// Nothing here is written down as a coordinate, because no coordinate would be right twice. Every
// generated room has a staircase and at least one hall standing open through both storeys, and no
// two rooms put them in the same place — so a route written against one room is a route that only
// works on the machine whose database that room happened to be in.
//
// They are found instead, from the grid the room was built from, using the one thing that is true of
// every room: the two storeys have their floors at the bottom and the middle of the room's height,
// and *nothing else does*. So of all the places the player can stand —
//
//   - the ones on the lowest layer are the ground floor,
//   - the ones on the middle layer are the upper floor,
//   - and the ones in between, which no floor accounts for, are the treads of a staircase.
//
// A gallery edge falls out of the same list: it is a cell of the upper floor with a neighbour that
// is floor below and nothing above. That is how each of these shots finds its vantage, and it is why
// this script does not care which room it is run against.
//
// The drop reads as a drop in first person and nowhere else: the game pitches the view down over
// open space by itself, and that is what a shot of somebody looking downstairs is. It pitches down
// hard, though, so such a frame is mostly the floor below — which is why each is taken with the near
// edge of the floor the player is standing on inside the frame, to give that floor somewhere to fall
// away from.

const GROUND_LAYER = 0;
const UPPER_LAYER = 8;            // Where the storey floor puts the upper storey's standing height.
const ALL_SPOTS = 4000;           // More than a room has, so the whole grid comes back.

const EDIT_SWING_DEG = -110;
const EDIT_ZOOM = 0.7;

// How many of the room's flights are worth trying for a shot, and how far off the foot of one to
// look for somewhere to stand. Close enough that the steps fill the frame, far enough that the
// camera is not standing in them.
const VIEWABLE_FLIGHTS = 4;
const STAIRS_CANDIDATES = 10;
const MIN_STAIRS_DISTANCE = 2.5;
const MAX_STAIRS_DISTANCE = 7;

// How many gallery edges to look through before giving up, and how much open floor has to run
// beyond one for it to be worth standing at.
const GALLERY_CANDIDATES = 12;
const MIN_GALLERY_DEPTH = 3;
const MAX_GALLERY_DEPTH = 12;

const key = (spot) => `${spot.row},${spot.col}`;

module.exports = {
    slug: "second-floor",

    // A generated room rather than the sandbox: this post is about the game itself, so the picture
    // has to be taken in a room the generator made. Seeded from a fixed seed and removed afterwards.
    freshRoom: true,

    devUser: 1,
    startPath: "/",
    tutorial: false,
    // A Regular room is built one storey tall on purpose (see RegularRoomBuilder), so there would be
    // no upstairs in it to photograph. Only a hub is raised through both storeys.
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
        // Treads have to be grouped into the flights they belong to first. A room has more than one
        // staircase, and taking the lowest tread in the room together with the highest describes no
        // flight at all — it is the bottom of one and the top of another, and aiming from one to the
        // other aims through whatever wall stands between them.
        const flights = groupIntoFlights(treads);
        log(`${flights.length} flight(s) of steps`);

        // Which flight can actually be photographed is not decided by which is tallest. A staircase
        // in a stairwell is walled in on every side a camera could stand, so the flight is chosen
        // together with somewhere to view it from — the tallest first, and the next one if that has
        // nowhere to stand.
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
        // The grid says which cells have floor; it cannot say what is above them, so a cell with a
        // wall standing on it looks from the grid exactly like one open to the storey below. Which
        // of the two an edge is gets settled the same way the staircase's vantage was: by standing
        // there and looking.
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
        // Aimed out over the drop, where the only thing within reach is the ground floor — and where
        // nothing stands between the camera and it to be cleared out of the way, which is what
        // leaves a hole in a shot taken down through a storey floor.
        const reached = await interact.clickSurfaceUntilEnabled("startEditingButton",
            { objectType: "Voxel" }).then(() => true, (err) => { log(`  ${err.message}`); return false; });

        if (reached)
        {
            await clickId("startEditingButton");
            await sleep(2000);
            if (await ctx.page.locator("#addVoxelBlockButton").first().isVisible().catch(() => false))
            {
                // Only swung, never lifted: the orbit opens at the gallery's own height looking
                // down, which is the view this shot wants, and lifting it further ends up overhead.
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

// How far the view runs before it meets something, at the middle of the frame. A camera with its
// nose against a wall reports a step or two; one looking down a room reports the length of it. This
// is the difference between a vantage and a position, and it cannot be worked out from coordinates —
// which is the whole reason the page is asked instead.
const CLEAR_VIEW_DISTANCE = 3.5;

// How far beneath the player's own height a ray has to land for what it hit to be the storey below
// rather than something standing on his own. A storey is several times this, so it separates the two
// without having to know exactly how tall one is.
const DROP_BELOW_HEIGHT = 2.5;

/**
 * Stands the player somewhere he can actually see a flight from, and says where that was.
 *
 * Candidates are ground-floor cells a few paces off the foot of the flight — near enough that the
 * steps fill the frame, far enough that the camera is not inside them. Each is tried and *looked
 * through*: whether a cell has a view of the stairs or of the wall beside them is not something the
 * grid can be asked, so the one thing that can answer it is.
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

    // Aimed at the middle of the flight rather than its top. Facing the head puts the steps off to
    // one side of the frame with a blank wall taking up the rest — the flight rises as it recedes,
    // so its middle is what sits in front of the camera.
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

/**
 * Whether what the camera is looking at is the storey below, rather than a wall a comfortable
 * distance away.
 *
 * Distance alone cannot tell those apart — a room is as deep as a drop is — and the difference is
 * the entire subject of the shot. What separates them is height: the floor below sits a storey down,
 * so a ray that lands well beneath the player's own feet has found the drop, and one that lands at
 * his own level has found a wall across the room.
 */
async function looksDownOntoTheFloorBelow(ctx)
{
    const hit = await probeAhead(ctx);
    if (hit == null)
        return false; // Open sky, not open floor: nothing to look down onto.
    const pose = await ctx.setup.pose();
    return pose.y - hit.world.y >= DROP_BELOW_HEIGHT;
}

/**
 * Groups tread cells into the flights they belong to, best first.
 *
 * Two treads belong to the same flight when they touch and are within a step of each other in
 * height, which is exactly what a flight is: cells that a walker can pass between. Everything else
 * about a staircase — where it starts, which way it doubles back, how long it is — comes out of the
 * grouping rather than having to be described.
 *
 * Ordered by how much height each flight covers, so the first one is the fullest climb in the room
 * rather than a couple of steps up onto a plinth.
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
 * Cells of the upper storey standing next to what might be open air, deepest run first.
 *
 * A neighbour with floor below it and no floor at this height is *either* a hall carried through
 * both storeys — which is what a gallery looks over — *or* a wall standing on that floor. The grid
 * cannot tell the two apart, since neither is somewhere the player can stand, which is why this
 * returns candidates rather than an answer and the caller looks through each.
 *
 * Ordered by how far the run continues, so the widest hall in the room is tried before a one-cell
 * ledge: that is the difference between a frame with a room in it and a frame looking down a gap.
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
