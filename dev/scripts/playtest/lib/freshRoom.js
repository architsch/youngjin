// Seeds a local run's room from a fixed seed (see RoomGenerationUtil), owned by the run's dev user so
// it's editable, and removes it afterwards. Existing rooms differ per machine and keep earlier runs'
// edits, so coordinates written against them don't reproduce.

const { generateRoomContent } = require("../generateRoomContent");
const DBGuard = require("./dbGuard");

// The `npm run dev` emulator (ports from firebase.json). Set in the environment, since that is what
// tells dbGuard "local" isn't live.
const EMULATOR_DEFAULTS = {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    GCLOUD_PROJECT: "thingspool",
};

// Stamped on the seeded room and checked before removal, so a wrong id can't delete a real room.
const MARKER = "__localFreshRoom";

// Mirrors RoomTypeEnumMap. Regular rooms are one storey (see RegularRoomBuilder), so anything upstairs
// needs "hub".
const ROOM_TYPES = { hub: 0, regular: 1 };
const DEFAULT_ROOM_TYPE = ROOM_TYPES.regular;

const ROOM_VERSION = 4; // Mirrors DBRoomVersionMigration's length; `verify` below reports a drift.
const CONTENT_FILE = "content.bin";

// Seeded dev users in ?devuser=N order (see DevUserSeedUtil); the room must be owned by the run's user.
const DEV_USER_EMAILS = ["devmember1@test.com", "devmember2@test.com", "devmember3@test.com",
    "devadmin@test.com"];

// One connection per process (firebase-admin's initializeApp runs once).
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

// Accepts a name ("hub") or the stored integer.
function resolveRoomType(requested)
{
    if (requested == undefined)
        return DEFAULT_ROOM_TYPE;
    if (typeof requested == "number")
        return requested;

    const resolved = ROOM_TYPES[String(requested).toLowerCase()];
    if (resolved == undefined)
    {
        throw new Error(`Unknown room type "${requested}". A seeded room is one of: ` +
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
 * Generates and writes a room, returning what the run needs to open and remove it. The blob and row come
 * from one generation call, since texture indices only mean something within its texture pack.
 */
async function seedFreshRoom(options = {})
{
    const seed = options.seed === undefined ? 0 : options.seed;
    const roomType = resolveRoomType(options.roomType);
    const {db, bucket, target} = connect();
    const owner = await findDevUser(db, options.devUser === undefined ? 1 : options.devUser);

    const generated = generateRoomContent(
        options.roomName || "Fresh Room", roomType, owner.id, owner.userName, seed);

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

/** Removes a room this module seeded; a room without the marker is refused. */
async function removeFreshRoom(seeded)
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
            `seeded by a local run.`);
    }

    await bucket.file(contentPath(seeded.roomID)).delete().catch(() => {});
    await roomRef.delete();
    return true;
}

module.exports = { seedFreshRoom, removeFreshRoom, MARKER };
