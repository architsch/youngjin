import mysql from "mysql2/promise";
import ServerLogUtil from "../../networking/util/serverLogUtil";
import { SQLQueryParamType } from "./sqlQueryParamType";
import SQLQueryResponse from "./sqlQueryResponse";
import DB from "../db";
import ErrorUtil from "../../../shared/system/util/errorUtil";

export default class SQLQuery<ReturnDataType>
{
    public queryStr: string;
    public queryParams?: SQLQueryParamType[];

    constructor(queryStr: string, queryParams?: SQLQueryParamType[])
    {
        this.queryStr = queryStr;
        this.queryParams = queryParams;
    }

    async run(): Promise<SQLQueryResponse<ReturnDataType>>
    {
        ServerLogUtil.log("SQL Query Started", {queryStr: this.queryStr/*, queryParams: this.queryParams*/}, "low");

        let pool: mysql.Pool | undefined = DB.getPool();
        try {
            if (!pool)
            {
                ServerLogUtil.logRaw("SQL Connection Pool Failed To Load", "high", "pink");
                return { success: false, data: [] };
            }
            const [results, fields] = await pool.query<mysql.RowDataPacket[]>(this.queryStr, this.queryParams);
            ServerLogUtil.log("SQL Query Succeeded", {queryStr: this.queryStr/*, queryParams: this.queryParams*/}, "medium");
            return { success: true, data: results as ReturnDataType[] };
        }
        catch (err) {
            ServerLogUtil.log("SQL Query Error", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "pink");
            return { success: false, data: [] };
        }
    }
}