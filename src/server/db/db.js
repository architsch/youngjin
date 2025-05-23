const mysql = require("mysql2/promise");
const envUtil = require("../util/envUtil.js");
const fileUtil = require("../util/fileUtil.js");
const debugUtil = require("../util/debugUtil.js");
require("dotenv").config();

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
    query: function (queryStr, queryParams = undefined)
    {
        this.queryStr = queryStr;
        this.queryParams = queryParams;

        this.run = async (res) => {
            let conn;
            try {
                conn = await pool.getConnection();
                const [results, fields] = await conn.query(queryStr, queryParams);
                debugUtil.log("SQL Query Succeeded", {queryStr, queryParams}, "medium");
                return results;
            }
            catch (err) {
                debugUtil.log("SQL Query Error", {err}, "high");
                if (res)
                    res.status(500).send(err);
            }
            finally {
                conn?.release();
                res?.status(202);
            }
        };
    },
    transaction: function (queries)
    {
        this.run = async (res) => {
            debugUtil.log("SQL Transaction Began", {numQueries: queries.length}, "low");
            let conn;
            let success = false;
            let count = 0;
            try {
                conn = await pool.getConnection();
                await conn.beginTransaction();

                let resultsGroup = [];
                for (const query of queries)
                {
                    count++;
                    const [results, fields] = await conn.query(query.queryStr, query.queryParams);
                    if (results.affectedRows == 0)
                    {
                        await conn.rollback();
                        debugUtil.log("SQL Transaction Query Made No Change", {progress: `${count}/${queries.length}`, query}, "high");
                        res?.status(403);
                        return;
                    }
                    debugUtil.log("SQL Transaction Query Succeeded", {progress: `${count}/${queries.length}`, query}, "low");
                    resultsGroup.push(results);
                }

                await conn.commit();
                debugUtil.logRaw("SQL Transaction Committed", "medium");
                success = true;
                return resultsGroup;
            }
            catch (err) {
                debugUtil.log("SQL Transaction Error", {progress: `${count}/${queries.length}`, err}, "high", "pink");
                await conn.rollback();
                if (res)
                    res.status(500).send(err);
            }
            finally {
                conn?.release();
                if (success)
                    res?.status(202);
            }
        };
    },
    runSQLFile: async (fileName) => {
        debugUtil.log("Opening SQL File", {fileName}, "high");
        const sql = await fileUtil.read(fileName, "src/server/db/sql");
        const sqlStatements = sql.split(";").map(x => x.trim() + ";").filter(x => x.length > 1);
        let conn;

        try {
            conn = await mysql.createConnection({
                host: dev ? process.env.SQL_HOST_DEV : process.env.SQL_HOST_PROD,
                user: dev ? process.env.SQL_USER_DEV : process.env.SQL_USER_PROD,
                password: dev ? process.env.SQL_PASS_DEV : process.env.SQL_PASS_PROD,
            });
            conn.connect();

            for (const sqlStatement of sqlStatements)
            {
                const [results, fields] = await conn.query(sqlStatement);
            }
        }
        catch (err) {
            debugUtil.log("SQL File Execution Error", {err}, "high");
        }
        finally {
            conn?.end();
        }
    },
    toHTMLString: async () => {
        const section = (text) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj) => textUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(await query(res, "SELECT * FROM users;")) +
            section("rooms") + toSafeStr(await query(res, "SELECT * FROM rooms;")) +
            section("user_rooms") + toSafeStr(await query(res, "SELECT * FROM user_rooms;")) +
            section("emailVerifications") + toSafeStr(await query(res, "SELECT * FROM emailVerifications;"));
        return content;
    },
}

module.exports = db;