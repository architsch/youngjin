import mysql from "mysql2/promise";
import { Response } from "express";
import Query from "./query";
import debugUtil from "../../util/debugUtil";

export default class transaction
{
    public queries: Query<void>[];

    private pool: mysql.Pool;

    constructor(pool: mysql.Pool, queries: Query<void>[])
    {
        this.pool = pool;
        this.queries = queries;
    }

    async run(res?: Response): Promise<void>
    {
        debugUtil.log("SQL Transaction Began", {numQueries: this.queries.length}, "low");
        let conn: mysql.PoolConnection | undefined = undefined;
        let success = false;
        let count = 0;
        try {
            conn = await this.pool.getConnection();
            await conn.beginTransaction();

            for (const query of this.queries)
            {
                count++;
                const [result, fields] = await conn?.query<mysql.ResultSetHeader>(query.queryStr, query.queryParams);
                if (result.affectedRows == 0)
                {
                    await conn?.rollback();
                    debugUtil.log("SQL Transaction Query Made No Change", {progress: `${count}/${this.queries.length}`, query}, "high");
                    res?.status(403);
                    return;
                }
                debugUtil.log("SQL Transaction Query Succeeded", {progress: `${count}/${this.queries.length}`, query}, "low");
            }

            await conn?.commit();
            debugUtil.logRaw("SQL Transaction Committed", "medium");
            success = true;
        }
        catch (err) {
            debugUtil.log("SQL Transaction Error", {progress: `${count}/${this.queries.length}`, err}, "high", "pink");
            await conn?.rollback();
            res?.status(500).send(err);
        }
        finally {
            conn?.release();
            if (success)
                res?.status(202);
        }
    };
}