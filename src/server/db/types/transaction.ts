import mysql from "mysql2/promise";
import { Response } from "express";
import Query from "./query";
import DebugUtil from "../../util/debugUtil";

export default class Transaction
{
    public queries: Query<void>[];

    private pool: mysql.Pool;

    constructor(pool: mysql.Pool, queries: Query<void>[])
    {
        this.pool = pool;
        this.queries = queries;
    }

    async run(res?: Response, stackTraceName?: string): Promise<void>
    {
        if (stackTraceName)
            DebugUtil.pushStackTrace(stackTraceName);
        DebugUtil.log("SQL Transaction Began", {numQueries: this.queries.length}, "low");

        let conn: mysql.PoolConnection | undefined = undefined;
        let success = false;
        let count = 0;
        try {
            conn = await this.pool.getConnection();
            await conn.beginTransaction();

            for (const query of this.queries)
            {
                count++;
                DebugUtil.log("SQL Transaction Query Started", {progress: `${count}/${this.queries.length}`, query}, "low");
                const [result, fields] = await conn?.query<mysql.ResultSetHeader>(query.queryStr, query.queryParams);
                if (result.affectedRows == 0)
                {
                    await conn?.rollback();
                    DebugUtil.log("SQL Transaction Query Made No Change", {progress: `${count}/${this.queries.length}`, query}, "high");
                    if (stackTraceName)
                        DebugUtil.popStackTrace(stackTraceName);
                    res?.status(403);
                    return;
                }
                DebugUtil.log("SQL Transaction Query Succeeded", {progress: `${count}/${this.queries.length}`, query}, "low");
            }

            await conn?.commit();
            DebugUtil.logRaw("SQL Transaction Committed", "medium");
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            success = true;
        }
        catch (err) {
            DebugUtil.log("SQL Transaction Error", {progress: `${count}/${this.queries.length}`, err}, "high", "pink");
            await conn?.rollback();
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            res?.status(500).send(err);
        }
        finally {
            conn?.release();
            if (success)
                res?.status(202);
        }
    };
}