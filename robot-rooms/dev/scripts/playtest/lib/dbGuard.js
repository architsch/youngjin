// The barrier between the playtest tooling and the live database. Live and staging share one Firebase
// project and bucket, separated only by a collection prefix, so no playtest script builds its own handle.
// Scripts get a facade that can only name the requested namespace:
//   - Targets are `staging` and `local` only; "live" isn't accepted.
//   - Every collection name and storage path is checked against the target's prefix before the SDK.
//   - `local` requires the emulator environment variables (unprefixed without an emulator is live).
// The other two layers: deny rules in .claude/settings.json (blocking gcloud/firebase CLI access to
// live), and the staging-playtest skill's rule that scripts obtain handles here.

const admin = require("firebase-admin");

const PROJECT_ID = "thingspool";
const STORAGE_BUCKET = "thingspool.firebasestorage.app";

// The live (unprefixed) namespace, named only so the check can reject it explicitly.
const LIVE_PREFIX = "";

const TARGETS = {
    // Deployed staging. Shares project and bucket with live; the prefix is the only separation, so it's
    // enforced on every path.
    staging: { prefix: "staging_", requiresEmulator: false },
    // Local emulators. Unprefixed like live, and safe only because the emulator host variables redirect
    // it (hence the check).
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

// Rejects names without the target's prefix, or with path syntax that could escape the collection.
function assertInNamespace(target, name, what)
{
    if (typeof name !== "string" || name.length === 0)
        throw new Error(`Refusing empty ${what}.`);

    if (name.includes("..") || name.startsWith("/"))
        throw new Error(`Refusing ${what} "${name}" — path traversal.`);

    if (target.prefix === LIVE_PREFIX)
    {
        // Only reached for the emulator, whose host resolveTarget already verified.
        return name;
    }

    if (!name.startsWith(target.prefix))
        throw new Error(
            `Refusing ${what} "${name}" — target "${target.name}" may only address names ` +
            `beginning with "${target.prefix}". An unprefixed name is a live one.`);

    return name;
}

// The Firestore facade: only the two entry points the tooling needs, so nothing unguarded is reachable.
// References it returns stay within their collection, so one name check suffices.
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

        // Batch writes use references from collection() above, already checked.
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

        // The prefix is required, since an unscoped listing would enumerate live rooms' content.
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

// Resolves --target and returns the guarded handles plus a description every command should print.
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

// ─── Read-only access, including live ───────────────────────────────────
// Some questions (which traffic sources retain people) only live data answers, so live is a read-only
// target here and nowhere else, kept narrow three ways:
//   - The facade exposes reads returning plain data: no references, batches, or path back to the SDK.
//   - Only READABLE_COLLECTIONS may be named: aggregate counters with nothing per-person (not users).
//   - Targets still resolve via resolveTarget, so the emulator checks for "local" still apply.
// These unprefixed names are the live ones, which is why the write path refuses them.
const READABLE_COLLECTIONS = ["acquisition"];

function resolveReadTarget(name)
{
    const requested = String(name || "staging").toLowerCase();

    if (requested === "live" || requested === "prod" || requested === "production")
    {
        if (process.env.FIRESTORE_EMULATOR_HOST)
            throw new Error(
                `Target "live" addresses the deployed server, but FIRESTORE_EMULATOR_HOST is set to ` +
                `"${process.env.FIRESTORE_EMULATOR_HOST}", so every read would go to the emulator ` +
                `instead and quietly report zeroes. Unset it.`);
        return { name: "live", prefix: LIVE_PREFIX, emulator: false };
    }

    return resolveTarget(requested);
}

function assertReadable(target, name)
{
    if (!READABLE_COLLECTIONS.includes(name))
        throw new Error(
            `Refusing to read collection "${name}". This path may only read: ` +
            `${READABLE_COLLECTIONS.join(", ")}.`);

    return `${target.prefix}${name}`;
}

// Plain objects keyed by id: snapshots carry references, and a reference can write.
function toPlainDocs(snapshot)
{
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function readOnlyFirestore(db, target)
{
    return {
        target: target.name,
        prefix: target.prefix,

        // `name` is unprefixed; the target's prefix is applied here, so callers can't name another namespace.
        async readAll(name)
        {
            return toPlainDocs(await db.collection(assertReadable(target, name)).get());
        },

        async readWhere(name, field, op, value)
        {
            return toPlainDocs(await db.collection(assertReadable(target, name)).where(field, op, value).get());
        },
    };
}

// Read-only counterpart of connect(); accepts --app (as serverMonitor.js does) as well as --target.
function connectReadOnly(argv)
{
    const appIndex = argv.indexOf("--app");
    const targetIndex = argv.indexOf("--target");
    const index = appIndex >= 0 ? appIndex : targetIndex;
    const requested = index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : "staging";
    const target = resolveReadTarget(requested);

    if (admin.apps.length === 0)
        admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });

    return {
        target,
        db: readOnlyFirestore(admin.firestore(), target),
        describe: () => ({
            target: target.name,
            collectionPrefix: target.prefix || (target.name === "live" ? "(none — live)" : "(none — emulator)"),
            firestore: target.emulator ? process.env.FIRESTORE_EMULATOR_HOST : `${PROJECT_ID} (cloud)`,
            access: "read-only",
        }),
    };
}

// Field sentinels (delete, increment) name no path; they only act through guarded references.
const FieldValue = admin.firestore.FieldValue;

module.exports = {
    connect, connectReadOnly, resolveTarget, assertInNamespace, FieldValue,
    PROJECT_ID, STORAGE_BUCKET, READABLE_COLLECTIONS,
};
