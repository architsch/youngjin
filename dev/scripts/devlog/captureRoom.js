// Seeds the room a capture run opens on, and takes it away again afterwards.
//
// Without this a shot script has to name a room that already exists, which means a room id from
// whichever hub one machine's development database happened to hold when the script was written.
// That is a coordinate system nobody else has: the same id on another machine is a different
// interior or no room at all, so the route and the click points written against it are wrong
// everywhere but where they were found. Rooms are also saved, so even on the machine it was written
// on, a script inherits whatever the last run built — a picture hung by an earlier attempt is still
// on the wall, and the click that used to select a patch of wall now selects that picture.
//
// So the room is made here instead, from a fixed seed, by the game's own generator. The same seed
// lays out the same interior every time and on every machine (see RoomGenerationUtil, whose `seed`
// parameter this exists to pass), and removing it at the end of the run is what stops the next run
// inheriting anything.
//
// Nothing about this is capture-specific except the defaults. It seeds one room, at a seed the
// caller names, owned by whichever dev user the run is signed in as — which is what makes the room
// editable, since edit mode belongs to the room's owner.

const { generateRoomContent } = require("../playtest/generateRoomContent");
const DBGuard = require("../playtest/lib/dbGuard");

// The emulator this points at is the one `npm run dev` starts, on the ports firebase.json declares.
// Defaulted rather than required because a capture run is started against a local dev server and
// there is only one local database it could mean — but written into the environment rather than
// assumed past the guard, since it is the presence of these that tells dbGuard "local" is not live.
const EMULATOR_DEFAULTS = {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    GCLOUD_PROJECT: "thingspool",
};

// Stamped on the room this writes, and checked before it is removed, so that a mistaken id can
// never delete a room somebody was working in.
const MARKER = "__devlogCaptureRoom";

// Mirrors RoomTypeEnumMap. Which one a capture wants is not a detail: the two are built by
// different builders and come out structurally different, and a Regular room is deliberately only
// one storey tall (see RegularRoomBuilder). So a shot of anything upstairs — a gallery, a staircase,
// a room seen from above — has to be taken in a Hub, and asking for a Regular one gets a room with
// no upstairs to photograph rather than an error.
const ROOM_TYPES = { hub: 0, regular: 1 };
const DEFAULT_ROOM_TYPE = ROOM_TYPES.regular;

const ROOM_VERSION = 4; // Mirrors DBRoomVersionMigration's length; `verify` below reports a drift.
const CONTENT_FILE = "content.bin";

// The seeded dev users, in the order ?devuser=N names them (see DevUserSeedUtil). A capture is
// signed in as one of these, and the room has to be owned by that same one to be editable.
const DEV_USER_EMAILS = ["devmember1@test.com", "devmember2@test.com", "devmember3@test.com",
    "devadmin@test.com"];

// One connection per process: firebase-admin's initializeApp may only be called once, and a run
// seeds at the start and removes at the end.
let connection = null;

function connect()
{
    if (connection != null)
        return connection;

    for (const [name, value] of Object.entries(EMULATOR_DEFAULTS))
    {
        if (!process.env[name])
            process.env[name] = value;
    }

    connection = DBGuard.connect(["--target", "local"]);
    return connection;
}

/** Which document holds the room, and where its blob lives. Both unprefixed, this being local. */
const roomsCollection = () => "rooms";
const contentPath = (roomID) => `${roomsCollection()}/${roomID}/${CONTENT_FILE}`;

// Accepts either the name a shot script would write or the number the row carries, so a script says
// `roomType: "hub"` and nothing has to remember which integer that is.
function resolveRoomType(requested)
{
    if (requested == undefined)
        return DEFAULT_ROOM_TYPE;
    if (typeof requested == "number")
        return requested;

    const resolved = ROOM_TYPES[String(requested).toLowerCase()];
    if (resolved == undefined)
    {
        throw new Error(`Unknown room type "${requested}". A capture room is one of: ` +
            `${Object.keys(ROOM_TYPES).join(", ")}.`);
    }
    return resolved;
}

async function findDevUser(db, devUser)
{
    const email = DEV_USER_EMAILS[Math.max(1, devUser) - 1];
    if (email == undefined)
        throw new Error(`There is no dev user ${devUser}; ?devuser= names 1..${DEV_USER_EMAILS.length}.`);

    const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snapshot.empty)
    {
        throw new Error(
            `No seeded dev user found for "${email}". They are created by the server at boot, so ` +
            `start the dev server (npm run devnossg) and open the game once before seeding a room.`);
    }
    return {id: snapshot.docs[0].id, userName: snapshot.docs[0].data().userName || "DevMember1"};
}

/**
 * Generates a room and writes it, returning what the run needs to open and later remove it.
 *
 * The blob and the row are two halves of one room and have to agree: a room's voxel texture indices
 * are positions within one particular pack's atlas, so a row whose texturePackPath came from
 * somewhere other than the generation that produced the blob describes a room that could never have
 * been generated. Both therefore come from the same call.
 */
async function seedCaptureRoom(options = {})
{
    const seed = options.seed === undefined ? 0 : options.seed;
    const roomType = resolveRoomType(options.roomType);
    const {db, bucket, target} = connect();
    const owner = await findDevUser(db, options.devUser === undefined ? 1 : options.devUser);

    const generated = generateRoomContent(
        options.roomName || "Capture Room", roomType, owner.id, owner.userName, seed);

    const roomRef = db.collection(roomsCollection()).doc();
    await roomRef.set({
        version: ROOM_VERSION,
        roomName: generated.roomName,
        roomType: generated.roomType,
        ownerUserID: owner.id,
        ownerUserName: owner.userName,
        texturePackPath: generated.texturePackPath,
        editors: [],
        [MARKER]: true,
    });
    await bucket.file(contentPath(roomRef.id)).save(generated.content,
        {metadata: {contentType: "application/octet-stream"}, resumable: false});

    return {
        roomID: roomRef.id,
        seed,
        roomType,
        target: target.name,
        ownerUserID: owner.id,
        ownerUserName: owner.userName,
        texturePackPath: generated.texturePackPath,
        voxelCount: generated.voxelCount,
        objectCount: generated.objectCount,
    };
}

/**
 * Removes a room this module seeded. It will not remove one it did not: the marker is the whole
 * safeguard, and a room without it is somebody's.
 */
async function removeCaptureRoom(seeded)
{
    const {db, bucket} = connect();
    const roomRef = db.collection(roomsCollection()).doc(seeded.roomID);

    const snapshot = await roomRef.get();
    if (!snapshot.exists)
        return false;
    if (snapshot.data()[MARKER] !== true)
    {
        throw new Error(
            `Refusing to remove room "${seeded.roomID}" — it carries no ${MARKER}, so it was not ` +
            `seeded by a capture run.`);
    }

    await bucket.file(contentPath(seeded.roomID)).delete().catch(() => {});
    await roomRef.delete();
    return true;
}

module.exports = { seedCaptureRoom, removeCaptureRoom, MARKER };
