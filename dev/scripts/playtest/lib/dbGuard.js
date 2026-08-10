// The barrier between the playtest tooling and the live database.
//
// The tooling exists to write to a database directly, which is the whole reason it can produce
// states ordinary play cannot. That same capability pointed one namespace to the left would be
// editing production. The live and staging data live in one Firebase project and one storage
// bucket, separated only by a collection-name prefix, so "which database am I talking to" is a
// string comparison — and a string comparison is exactly the kind of thing that goes wrong
// quietly.
//
// So no playtest script constructs a Firestore or Storage handle itself. They ask here, and
// what they get back is a facade that can only name the namespace they asked for:
//
//   - There are two targets, `staging` and `local`, and no third one. "live" is not a value
//     this module accepts; it is not a target that exists.
//   - Every collection name and every storage path is checked against the target's prefix
//     before it reaches the SDK, so a typo or a bad flag fails loudly instead of resolving to
//     a live collection.
//   - `local` demands the emulator environment variables, because an empty prefix with no
//     emulator is not "local" — it is live, and it is the one mistake that would look right in
//     every log line until the damage was done.
//
// This is one layer of three. The other two are outside this file: the deny rules in
// .claude/settings.json, which stop an agent reaching the live data through the gcloud and
// firebase CLIs without going through Node at all; and the standing instruction in the
// staging-playtest skill that a playtest script must obtain its handles here. This layer is the
// one that holds without anybody remembering it.

const admin = require("firebase-admin");

const PROJECT_ID = "thingspool";
const STORAGE_BUCKET = "thingspool.firebasestorage.app";

// The live namespace is the unprefixed one. It is named here only so that the check below can
// recognise an attempt to reach it and say so plainly, never as somewhere to route to.
const LIVE_PREFIX = "";

const TARGETS = {
    // Deployed staging. Shares the project and the bucket with live; the prefix is the only
    // thing separating them, which is why it is enforced on every single path.
    staging: { prefix: "staging_", requiresEmulator: false },
    // The Firebase emulators on this machine. Unprefixed like live, and harmless *only*
    // because the emulator host variables send it somewhere else entirely — hence the check.
    local: { prefix: "", requiresEmulator: true },
};

function resolveTarget(name)
{
    const target = String(name || "staging").toLowerCase();

    if (target === "live" || target === "prod" || target === "production")
        throw new Error(
            `Refusing target "${target}". This tooling writes to the database, and there is no ` +
            `live write path in it by design. Read-only inspection of live is available through ` +
            `serverMonitor.js --app live.`);

    if (!TARGETS[target])
        throw new Error(`Unknown target "${target}". Valid targets: ${Object.keys(TARGETS).join(", ")}.`);

    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "";

    if (TARGETS[target].requiresEmulator && !emulatorHost)
        throw new Error(
            `Target "${target}" requires the Firestore emulator, and FIRESTORE_EMULATOR_HOST is ` +
            `not set. Without it this would address the unprefixed collections on the real ` +
            `project — which are the live ones. Start the emulators (npm run dev) and export ` +
            `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.`);

    if (!TARGETS[target].requiresEmulator && emulatorHost)
        throw new Error(
            `Target "${target}" addresses the deployed server, but FIRESTORE_EMULATOR_HOST is set ` +
            `to "${emulatorHost}", so every read and write would go to the emulator instead. ` +
            `Unset it, or use --target local.`);

    return { name: target, prefix: TARGETS[target].prefix, emulator: Boolean(emulatorHost) };
}

// A namespace check that has to pass before any name reaches the SDK. It rejects the two ways
// a name goes wrong: not carrying the target's prefix (so it belongs to another namespace), and
// carrying path syntax (so it could climb out of the collection it names).
function assertInNamespace(target, name, what)
{
    if (typeof name !== "string" || name.length === 0)
        throw new Error(`Refusing empty ${what}.`);

    if (name.includes("..") || name.startsWith("/"))
        throw new Error(`Refusing ${what} "${name}" — path traversal.`);

    if (target.prefix === LIVE_PREFIX)
    {
        // Only the emulator ever gets here, and only because resolveTarget already proved the
        // emulator host is set. On the emulator there is nothing to protect.
        return name;
    }

    if (!name.startsWith(target.prefix))
        throw new Error(
            `Refusing ${what} "${name}" — target "${target.name}" may only address names ` +
            `beginning with "${target.prefix}". An unprefixed name is a live one.`);

    return name;
}

// What the scripts get instead of a Firestore instance.
//
// A facade rather than a wrapper: it exposes the two entry points the tooling actually needs,
// so there is no unguarded method to reach past it by accident. A CollectionReference handed
// back from here stays inside its own collection through every query and document it produces,
// which is what makes checking the name once sufficient.
function guardedFirestore(db, target)
{
    return {
        target: target.name,
        prefix: target.prefix,

        // The only way into a collection. `name` is the full name including the prefix.
        collection(name)
        {
            return db.collection(assertInNamespace(target, name, "collection"));
        },

        // Batches carry no names of their own — every write in one is addressed by a reference
        // that came from collection() above, and so was checked there.
        batch()
        {
            return db.batch();
        },
    };
}

function guardedBucket(bucket, target)
{
    return {
        name: bucket.name,
        target: target.name,

        file(filePath)
        {
            return bucket.file(assertInNamespace(target, filePath, "storage path"));
        },

        // Listing is scoped by prefix, and an unscoped listing would enumerate the live rooms'
        // content, so the prefix is required rather than optional.
        getFiles(options)
        {
            const prefix = options && options.prefix;
            if (!prefix)
                throw new Error("Refusing an unscoped storage listing — pass { prefix }.");
            assertInNamespace(target, prefix, "storage listing prefix");
            return bucket.getFiles(options);
        },
    };
}

// Reads --target off the command line, resolves it, and returns the guarded handles plus a
// description of what was resolved. Every command should print that description, so which
// namespace was touched is never something the reader has to infer.
function connect(argv)
{
    const i = argv.indexOf("--target");
    const requested = i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : "staging";
    const target = resolveTarget(requested);

    admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });

    return {
        target,
        db: guardedFirestore(admin.firestore(), target),
        bucket: guardedBucket(admin.storage().bucket(), target),
        describe: () => ({
            target: target.name,
            collectionPrefix: target.prefix || "(none — emulator)",
            firestore: target.emulator ? process.env.FIRESTORE_EMULATOR_HOST : `${PROJECT_ID} (cloud)`,
            storage: target.emulator
                ? (process.env.FIREBASE_STORAGE_EMULATOR_HOST || "(emulator)")
                : STORAGE_BUCKET,
        }),
    };
}

module.exports = { connect, resolveTarget, assertInNamespace, PROJECT_ID, STORAGE_BUCKET };
