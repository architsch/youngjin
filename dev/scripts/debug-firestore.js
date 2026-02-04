const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

(async () => {
  try {
    const cols = await db.listCollections();
    console.log("ok", cols.length);
  } catch (e) {
    console.error("err", e);
  }
})();