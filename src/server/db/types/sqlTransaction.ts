import mysql from "mysql2/promise";
import SQLQuery from "./sqlQuery";
import ServerLogUtil from "../../networking/util/serverLogUtil";
import DB from "../db";
import ErrorUtil from "../../../shared/system/util/errorUtil";

export default class SQLTransaction
{
    public queries: SQLQuery<void>[];

    constructor(queries: SQLQuery<void>[])
    {
        this.queries = queries;
    }

    // Returns TRUE if the transaction succeeded, or FALSE otherwise.
    async run(): Promise<boolean>
    {
        ServerLogUtil.log("SQL Transaction Began", {numQueries: this.queries.length}, "low");

        let pool: mysql.Pool | undefined = DB.getPool();
        let conn: mysql.PoolConnection | undefined = undefined;
        let successCount = 0;
        try {
            if (!pool)
            {
                ServerLogUtil.logRaw("SQL Connection Pool Failed To Load", "high", "pink");
                return false;
            }
            conn = await pool.getConnection();
            if (!conn)
            {
                ServerLogUtil.logRaw("SQL Transaction Connection Failed", "high", "pink");
                return false;
            }
            await conn.beginTransaction();

            for (const query of this.queries)
            {
                await conn.execute(query.queryStr, query.queryParams);
                successCount++;
                ServerLogUtil.log("SQL Transaction Query Succeeded", {progress: `${successCount}/${this.queries.length}`, query}, "low");
            }
            await conn.commit();
            ServerLogUtil.logRaw("SQL Transaction Committed", "medium");
        }
        catch (err) {
            ServerLogUtil.log("SQL Transaction Error", {progress: `${successCount}/${this.queries.length}`, errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "pink");
            await conn?.rollback();
        }
        finally {
            conn?.release();
            return successCount == this.queries.length;
        }
    };
}