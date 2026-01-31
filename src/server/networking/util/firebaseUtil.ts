import * as admin from "firebase-admin";

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
    admin.initializeApp({
        storageBucket: "thingspool.firebasestorage.app",
    });
    db = admin.firestore();
    storage = admin.storage();
    firebaseInitialized = true;
}

export default FirebaseUtil;