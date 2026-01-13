import mysql from "mysql2/promise";
import { Response } from "express";
import SQLQuery from "./sqlQuery";
import DebugUtil from "../../util/debugUtil";
import DB from "../db";

export default class SQLTransaction
{
    public queries: SQLQuery<void>[];

    constructor(queries: SQLQuery<void>[])
    {
        this.queries = queries;
    }

    // Returns TRUE if the transaction succeeded, or FALSE otherwise.
    async run(res?: Response, stackTraceName?: string): Promise<boolean>
    {
        if (stackTraceName)
            DebugUtil.pushStackTrace(stackTraceName);
        DebugUtil.log("SQL Transaction Began", {numQueries: this.queries.length}, "low");

        let pool: mysql.Pool | undefined = DB.getPool();
        let conn: mysql.PoolConnection | undefined = undefined;
        let successCount = 0;
        try {
            if (!pool)
            {
                DebugUtil.logRaw("SQL Connection Pool Failed To Load", "high", "pink");
                res?.status(500).send("SQL Connection Pool Failed To Load");
                if (stackTraceName)
                    DebugUtil.popStackTrace(stackTraceName);
                return false;
            }
            conn = await pool.getConnection();
            if (!conn)
            {
                DebugUtil.logRaw("SQL Transaction Connection Failed", "high", "pink");
                res?.status(500).send("SQL Transaction Connection Failed");
                if (stackTraceName)
                    DebugUtil.popStackTrace(stackTraceName);
                return false;
            }
            await conn.beginTransaction();

            for (const query of this.queries)
            {
                const [queryResult] = await conn.execute(query.queryStr, query.queryParams);
                /*if (result.affectedRows == 0)
                {
                    await conn?.rollback();
                    DebugUtil.log("SQL Transaction Query Made No Change", {progress: `${count}/${this.queries.length}`, query}, "high");
                    if (stackTraceName)
                        DebugUtil.popStackTrace(stackTraceName);
                    res?.status(403);
                    success = false;
                    break;
                }*/
                successCount++;
                DebugUtil.log("SQL Transaction Query Succeeded", {progress: `${successCount}/${this.queries.length}`, query}, "low");
            }
            await conn.commit();
            res?.status(202);
            DebugUtil.logRaw("SQL Transaction Committed", "medium");
        }
        catch (err) {
            const errorMessage = (err instanceof Error) ? err.message : String(err);
            DebugUtil.log("SQL Transaction Error", {progress: `${successCount}/${this.queries.length}`, errorMessage}, "high", "pink");
            await conn?.rollback();
            res?.status(500).send(err);
        }
        finally {
            conn?.release();
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            return successCount == this.queries.length;
        }
    };
}