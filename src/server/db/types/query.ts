import mysql from "mysql2/promise";
import { Response } from "express";
import DebugUtil from "../../Util/DebugUtil";

export default class Query<ReturnType>
{
    public queryStr: string;
    public queryParams?: string[];

    private pool: mysql.Pool;

    constructor(pool: mysql.Pool, queryStr: string, queryParams?: string[])
    {
        this.pool = pool;
        this.queryStr = queryStr;
        this.queryParams = queryParams;
    }

    async run(res?: Response, stackTraceName?: string): Promise<ReturnType[]>
    {
        if (stackTraceName)
            DebugUtil.pushStackTrace(stackTraceName);
        DebugUtil.log("SQL Query Started", {queryStr: this.queryStr, queryParams: this.queryParams}, "low");

        try {
            const [result, fields] = await this.pool.query<mysql.RowDataPacket[]>(this.queryStr, this.queryParams);
            DebugUtil.log("SQL Query Succeeded", {queryStr: this.queryStr, queryParams: this.queryParams}, "medium");
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            res?.status(202);
            return result as ReturnType[];
        }
        catch (err) {
            DebugUtil.log("SQL Query Error", {err}, "high", "pink");
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            res?.status(500).send(err);
            return [];
        }
    }
}