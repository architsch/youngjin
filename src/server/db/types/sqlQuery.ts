import mysql from "mysql2/promise";
import { Response } from "express";
import DebugUtil from "../../util/debugUtil";
import { SQLQueryParamType } from "./sqlQueryParamType";
import SQLQueryResponse from "./sqlQueryResponse";
import DB from "../db";

export default class SQLQuery<ReturnDataType>
{
    public queryStr: string;
    public queryParams?: SQLQueryParamType[];

    constructor(queryStr: string, queryParams?: SQLQueryParamType[])
    {
        this.queryStr = queryStr;
        this.queryParams = queryParams;
    }

    async run(res?: Response, stackTraceName?: string): Promise<SQLQueryResponse<ReturnDataType>>
    {
        if (stackTraceName)
            DebugUtil.pushStackTrace(stackTraceName);
        DebugUtil.log("SQL Query Started", {queryStr: this.queryStr/*, queryParams: this.queryParams*/}, "low");

        let pool: mysql.Pool | undefined = DB.getPool();
        try {
            if (!pool)
            {
                DebugUtil.logRaw("SQL Connection Pool Failed To Load", "high", "pink");
                res?.status(500).send("SQL Connection Pool Failed To Load");
                if (stackTraceName)
                    DebugUtil.popStackTrace(stackTraceName);
                return { success: false, data: [] };
            }
            const [results, fields] = await pool.query<mysql.RowDataPacket[]>(this.queryStr, this.queryParams);
            DebugUtil.log("SQL Query Succeeded", {queryStr: this.queryStr/*, queryParams: this.queryParams*/}, "medium");
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            res?.status(202);
            return { success: true, data: results as ReturnDataType[] };
        }
        catch (err) {
            const errorMessage = (err instanceof Error) ? err.message : String(err);
            DebugUtil.log("SQL Query Error", {errorMessage}, "high", "pink");
            if (stackTraceName)
                DebugUtil.popStackTrace(stackTraceName);
            res?.status(500).send(err);
            return { success: false, data: [] };
        }
    }
}