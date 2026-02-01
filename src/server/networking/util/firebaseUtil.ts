import * as admin from "firebase-admin";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";

const FirebaseUtil =
{
    getDB: (): admin.firestore.Firestore =>
    {
        ensureFirebaseInitialized();
        return db;
    },
    getStorage: (): admin.storage.Storage =>
    {
        ensureFirebaseInitialized();
        return storage;
    },
}

let firebaseInitialized = false;
let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

function ensureFirebaseInitialized()
{
    if (firebaseInitialized)
        return;

    const app = admin.initializeApp();

    db = admin.firestore();
    storage = admin.storage();

    try {
        const optionsObj = getAppOptionsObj(app.options);
        LogUtil.log("Firebase App Initialized", { options: optionsObj }, "high", "info");
    } catch (err) {
        LogUtil.log("Failed to get Firebase app options", { errorMessage: ErrorUtil.getErrorMessage(err) }, "high", "error");
    }

    firebaseInitialized = true;
}

function getAppOptionsObj(options: admin.AppOptions): any
{
    const result: any = {};
    if (!options)
        return "{}";

    if (options.projectId)
        result.projectId = options.projectId;
    if (options.storageBucket)
        result.storageBucket = options.storageBucket;
    if (options.databaseURL)
        result.databaseURL = options.databaseURL;
    if (options.serviceAccountId)
        result.serviceAccountId = options.serviceAccountId;
    if (options.databaseAuthVariableOverride !== undefined)
        result.databaseAuthVariableOverride = options.databaseAuthVariableOverride;
    if (options.httpAgent)
        result.httpAgent = { constructorName: (options.httpAgent as any).constructor?.name || "Agent" };

    if (options.credential)
    {
        const c: any = options.credential as any;
        const credInfo: any = { present: true };
        if (typeof c.getAccessToken === "function")
            credInfo.getAccessToken = true;
        if (c.projectId)
            credInfo.projectId = c.projectId;
        if (c.client_email)
            credInfo.clientEmail = c.client_email;
        if (c.private_key)
            credInfo.privateKey = "[REDACTED]";
        result.credential = credInfo;
    }

    return result;
}

export default FirebaseUtil;