import * as admin from "firebase-admin";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import LogUtil from "../../../shared/system/util/logUtil";
import { DBRow } from "../types/row/dbRow";

export default async function runQueryInsert<T extends DBRow>(
    dbQuery: DBQuery<T>,
    collectionRef: admin.firestore.CollectionReference
): Promise<DBQueryResponse<T>>
{
    const docRef = await collectionRef.add(dbQuery.columnValues);
    LogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
    return { success: true, data: [({id: docRef.id} as any) as T] };
}