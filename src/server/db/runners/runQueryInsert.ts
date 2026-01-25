import ServerLogUtil from "../../networking/util/serverLogUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";

export default async function runInsert<T extends DBRow>(
    dbQuery: DBQuery<T>,
    collectionRef: FirebaseFirestore.CollectionReference
): Promise<DBQueryResponse<T>>
{
    await collectionRef.add(dbQuery.columnValues);
    ServerLogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
    return { success: true, data: [] };
}