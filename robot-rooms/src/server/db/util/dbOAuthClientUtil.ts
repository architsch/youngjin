import FirebaseUtil from "../../networking/util/firebaseUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import { COLLECTION_OAUTH_CLIENTS } from "../../system/serverConstants";

// The clients that registered themselves with the agents' OAuth (see AgentOAuthClientUtil), a document each, written
// directly as the helpers' spending is (see DBHelperSpendingUtil).
const DBOAuthClientUtil =
{
    // False if it couldn't be written.
    create: async (clientID: string, name: string, redirectURIs: string[]): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            await db.collection(COLLECTION_OAUTH_CLIENTS).doc(clientID).set({name, redirectURIs, createdAt: Date.now()});
            return true;
        }
        catch (err)
        {
            LogUtil.log("DBOAuthClientUtil - failed to register a client", {clientID, err}, "high", "error");
            return false;
        }
    },
    // Undefined if there's none, or it couldn't be read.
    get: async (clientID: string): Promise<{name: string, redirectURIs: string[]} | undefined> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = await db.collection(COLLECTION_OAUTH_CLIENTS).doc(clientID).get();
            const data = doc.data();
            return (doc.exists && data != undefined) ? {name: data.name ?? "", redirectURIs: data.redirectURIs ?? []}
                : undefined;
        }
        catch (err)
        {
            LogUtil.log("DBOAuthClientUtil - failed to read a client", {clientID, err}, "high", "error");
            return undefined;
        }
    },
}

export default DBOAuthClientUtil;
