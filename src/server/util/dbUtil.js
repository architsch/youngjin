const mysql = require("mysql2/promise");
const envUtil = require("./envUtil.js");
const fileUtil = require("./fileUtil.js");
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

const query = async (res, queryStr, queryParams = undefined, skipDebugMsg = false) =>
{
    let conn;

    try {
        conn = await pool.getConnection();
        if (!skipDebugMsg)
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

const dbUtil =
{
    runSQLFile: async (fileName) => {
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
    users: {
        selectByUserName: async (res, userName) =>
        {
            return await query(res, "SELECT * FROM users WHERE userName = ?;", [userName]);
        },
        selectByEmail: async (res, email) =>
        {
            return await query(res, "SELECT * FROM users WHERE email = ?;", [email]);
        },
        insert: async (res, userName, passwordHash, email) =>
        {
            return await query(res, "INSERT INTO users (userName, passwordHash, email) VALUES (?, ?, ?);",
                [userName, passwordHash, email]);
        },
    },
    emailVerifications: {
        selectByEmail: async (res, email) =>
        {
            return await query(res, "SELECT * FROM emailVerifications WHERE email = ?;", [email]);
        },
        insert: async (res, email, verificationCode, expirationTime) =>
        {
            return await query(res, "INSERT INTO emailVerifications (email, verificationCode, expirationTime) VALUES (?, ?, ?);",
                [email, verificationCode, expirationTime]);
        },
        updateExpirationTime: async (res, email, newExpirationTime) =>
        {
            return await query(res, "UPDATE emailVerifications SET expirationTime = ? WHERE email = ?;", [newExpirationTime, email]);
        },
        deleteExpired: async (res, currTime) =>
        {
            return await query(res, "DELETE FROM emailVerifications WHERE expirationTime < ?;", [currTime], true);
        },
    },
}

module.exports = dbUtil;