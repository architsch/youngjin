import mysql from "mysql2/promise";
import { Response } from "express";
import debugUtil from "../../util/debugUtil";

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

    async run(res?: Response): Promise<ReturnType[]>
    {
        try {
            const [result, fields] = await this.pool.query<mysql.RowDataPacket[]>(this.queryStr, this.queryParams);
            debugUtil.log("SQL Query Succeeded", {queryStr: this.queryStr, queryParams: this.queryParams}, "medium");
            res?.status(202);
            return result as ReturnType[];
        }
        catch (err) {
            debugUtil.log("SQL Query Error", {err}, "high", "pink");
            res?.status(500).send(err);
            return [];
        }
    }
}