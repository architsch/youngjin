const envUtil = require("../util/envUtil.js");
const db = require("./db.js");
require("dotenv").config();

const dbAuth =
{
    registerNewUser: async (res, userName, passwordHash, email) => {
        return await new db.query(
            "INSERT INTO users (userName, passwordHash, email) VALUES ('?', '?', '?');",
            [userName, passwordHash, email]
        ).run(res);
    },
}

module.exports = dbAuth;