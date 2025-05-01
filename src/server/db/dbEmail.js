const envUtil = require("../util/envUtil.js");
const db = require("./db.js");
require("dotenv").config();

const dbEmail =
{
    verifications: {
        selectByEmail: async (res, email) => {
            return await new db.query(
                "SELECT * FROM emailVerifications WHERE email = ?;",
                [email]
            ).run(res);
        },
        insert: async (res, email, verificationCode, expirationTime) => {
            return await new db.query(
                "INSERT INTO emailVerifications (email, verificationCode, expirationTime) VALUES (?, ?, ?);",
                [email, verificationCode, expirationTime]
            ).run(res);
        },
        updateExpirationTime: async (res, email, newExpirationTime) => {
            return await new db.query(
                "UPDATE emailVerifications SET expirationTime = ? WHERE email = ?;",
                [newExpirationTime, email]
            ).run(res);
        },
        deleteExpired: async (res, currTime) => {
            return await new db.query(
                "DELETE FROM emailVerifications WHERE expirationTime < ?;",
                [currTime]
            ).run(res);
        },
    },
}

module.exports = dbEmail;