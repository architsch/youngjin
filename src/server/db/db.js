const mysql = require("mysql2/promise");
const envUtil = require("../util/envUtil.js");
const fileUtil = require("../util/fileUtil.js");
require("dotenv").config();

const dev = envUtil.isDevMode();
const enableLog = dev;

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
                if (enableLog)
                    console.log(`[SQL Query Sent] :: ${queryStr}`);
                const [results, fields] = await conn.query(queryStr, queryParams);
                return results;
            }
            catch (err) {
                if (res)
                    res.status(500).send(`[SQL QUERY ERROR] :: ${err}`);
                else
                    console.error(`[SQL QUERY ERROR] :: ${err}`);
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
            let conn;
            let success = false;
            try {
                conn = await pool.getConnection();
                await conn.beginTransaction();
                if (enableLog)
                    console.log(`[SQL Transaction Began]`);

                let resultsGroup = [];
                for (const query of queries)
                {
                    if (enableLog)
                        console.log(`[SQL Transaction Query Sent] :: ${query.queryStr}`);
                    const [results, fields] = await conn.query(query.queryStr, query.queryParams);
                    if (results.affectedRows == 0)
                    {
                        await conn.rollback();
                        console.log(`[SQL Transaction Rolled Back] - because no rows were affected.`);
                        res?.status(403);
                        return;
                    }
                    resultsGroup.push(results);
                }

                await conn.commit();
                if (enableLog)
                    console.log(`[SQL Transaction Committed]`);
                success = true;
                return resultsGroup;
            }
            catch (err) {
                await conn.rollback();
                if (res)
                    res.status(500).send(`[SQL TRANSACTION ERROR] :: ${err}`);
                else
                    console.error(`[SQL TRANSACTION ERROR] :: ${err}`);
            }
            finally {
                conn?.release();
                if (success)
                    res?.status(202);
            }
        };
    },
    runSQLFile: async (fileName) => {
        if (enableLog)
            console.log(`[Opening SQL File] :: ${fileName}`);
        const sql = await fileUtil.read(fileName, "src/server/sql");
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
                //console.log("#############################################");
                //console.log(`[${sqlStatement}] ::\n\n${JSON.stringify(results, null, 4)}\n\n`);
            }
        }
        catch (err) {
            console.error(err);
        }
        finally {
            conn?.end();
        }
    },
    debug: {
        users: async (res) => await query(res, "SELECT * FROM users;"),
        rooms: async (res) => await query(res, "SELECT * FROM rooms;"),
        user_rooms: async (res) => await query(res, "SELECT * FROM user_rooms;"),
        emailVerifications: async (res) => await query(res, "SELECT * FROM emailVerifications;"),
    },
}

module.exports = db;