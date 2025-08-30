import mysql from "mysql2/promise";
import FileUtil from "../util/fileUtil";
import DebugUtil from "../util/debugUtil";
import TextUtil from "../../shared/util/textUtil";
import dotenv from "dotenv";
import Query from "./types/query";
import Transaction from "./types/transaction";
dotenv.config();

const dev = process.env.MODE == "dev";
let pool: mysql.Pool | undefined = undefined;

const DB =
{
    createPool: (): void =>
    {
        if (pool)
        {
            DebugUtil.logRaw("DB connection pool is already created.", "high", "pink");
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
            DebugUtil.logRaw("Failed to create a DB connection pool.", "high", "pink");
            return;
        }
    },
    makeQuery: <ReturnType>(queryStr: string, queryParams?: string[]): Query<ReturnType> =>
    {
        if (!pool)
            DB.createPool();
        return new Query<ReturnType>(pool!, queryStr, queryParams);
    },
    makeTransaction: (queries: Query<void>[]): Transaction =>
    {
        return new Transaction(pool!, queries);
    },
    runSQLFile: async (fileName: string): Promise<void> =>
    {
        DebugUtil.log("Opening SQL File", {fileName}, "high");
        const sql = await FileUtil.read(fileName, "sql");
        const sqlStatements = sql.split(";").map(x => x.trim() + ";").filter(x => x.length > 1);
        let conn: mysql.Connection | undefined = undefined;

        try {
            conn = await mysql.createConnection({
                host: dev ? process.env.SQL_HOST_DEV : process.env.SQL_HOST_PROD,
                user: dev ? process.env.SQL_USER_DEV : process.env.SQL_USER_PROD,
                password: dev ? process.env.SQL_PASS_DEV : process.env.SQL_PASS_PROD,
            });
            conn?.connect();
            for (const sqlStatement of sqlStatements)
                await conn?.query(sqlStatement);
        }
        catch (err) {
            DebugUtil.log("SQL File Execution Error", {err}, "high", "pink");
        }
        finally {
            conn?.end();
        }
    },
    toHTMLString: async (): Promise<string> =>
    {
        const section = (text: string) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj: {[key: string]: any}) => TextUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(await (DB.makeQuery("SELECT * FROM users;").run())) +
            section("rooms") + toSafeStr(await (DB.makeQuery("SELECT * FROM rooms;").run())) +
            section("roomMemberships") + toSafeStr(await (DB.makeQuery("SELECT * FROM roomMemberships;").run())) +
            section("emailVerifications") + toSafeStr(await (DB.makeQuery("SELECT * FROM emailVerifications;").run()));
        return content;
    },
}

export default DB;