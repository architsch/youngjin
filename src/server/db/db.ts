import mysql from "mysql2/promise";
import ServerLogUtil from "../networking/util/serverLogUtil";
import dotenv from "dotenv";
import SQLQuery from "./types/sqlQuery";
import SQLTransaction from "./types/sqlTransaction";
import { SQLQueryParamType } from "./types/sqlQueryParamType";
import SQLQueryResponse from "./types/sqlQueryResponse";
dotenv.config();

const dev = process.env.MODE == "dev";
let pool: mysql.Pool | undefined = undefined;

const DB =
{
    getPool(): mysql.Pool | undefined
    {
        if (!pool)
            createPool();
        return pool;
    },
    runQuery: async <ReturnDataType>(queryStr: string, queryParams?: SQLQueryParamType[])
        : Promise<SQLQueryResponse<ReturnDataType>> =>
    {
        return await (new SQLQuery<ReturnDataType>(queryStr, queryParams).run());
    },
    runTransaction: async (queries: SQLQuery<void>[]): Promise<boolean> =>
    {
        return await (new SQLTransaction(queries).run());
    },
}

function createPool()
{
    if (pool)
    {
        ServerLogUtil.logRaw("DB connection pool is already created.", "high", "pink");
        return;
    }
    pool = mysql.createPool({
        host: dev ? process.env.SQL_HOST_DEV : process.env.SQL_HOST_PROD,
        user: dev ? process.env.SQL_USER_DEV : process.env.SQL_USER_PROD,
        password: dev ? process.env.SQL_PASS_DEV : process.env.SQL_PASS_PROD,
        database: "main",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    });
    if (!pool)
    {
        ServerLogUtil.logRaw("Failed to create a DB connection pool.", "high", "pink");
        return;
    }
}

export default DB;