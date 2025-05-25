import mysql from "mysql2/promise";
import envUtil from "../util/envUtil";
import fileUtil from "../util/fileUtil";
import debugUtil from "../util/debugUtil";
import textUtil from "../../shared/util/textUtil";
import dotenv from "dotenv";
import Query from "./types/query";
import transaction from "./types/transaction";
dotenv.config();

const dev = envUtil.isDevMode();
const pool = mysql.createPool({
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

const db =
{
    makeQuery: <ReturnType>(queryStr: string, queryParams?: string[]): Query<ReturnType> =>
    {
        return new Query<ReturnType>(pool, queryStr, queryParams);
    },
    makeTransaction: (queries: Query<void>[]): transaction =>
    {
        return new transaction(pool, queries);
    },
    runSQLFile: async (fileName: string): Promise<void> =>
    {
        debugUtil.log("Opening SQL File", {fileName}, "high");
        const sql = await fileUtil.read(fileName, "sql");
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
            debugUtil.log("SQL File Execution Error", {err}, "high", "pink");
        }
        finally {
            conn?.end();
        }
    },
    toHTMLString: async (): Promise<string> =>
    {
        const section = (text: string) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj: {[key: string]: any}) => textUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(await (db.makeQuery("SELECT * FROM users;").run())) +
            section("rooms") + toSafeStr(await (db.makeQuery("SELECT * FROM rooms;").run())) +
            section("user_rooms") + toSafeStr(await (db.makeQuery("SELECT * FROM user_rooms;").run())) +
            section("emailVerifications") + toSafeStr(await (db.makeQuery("SELECT * FROM emailVerifications;").run()));
        return content;
    },
}

export default db;