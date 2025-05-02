const envUtil = require("../server/util/envUtil.js");
const db = require("../server/db/db.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
const testHTTP = require("./testHTTP.js");
const testRoutines = require("./testRoutines.js");
const testDB = require("./testDB.js");
const debugUtil = require("../server/util/debugUtil.js");
require("dotenv").config();

let testRunning = false;

async function test(testname)
{
    if (!envUtil.isDevMode())
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - You are not allowed to run tests on a non-dev mode.`);
        return;
    }
    if (testRunning)
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - There is another test running.`);
        return;
    }

    debugUtil.logRaw(`TEST STARTED (${testname})`);

    testRunning = true;
    testHTTP._reset();
    testDB._reset();
    const bypassEmailVerification_prev = globalConfig.auth.bypassEmailVerification;
    globalConfig.auth.bypassEmailVerification = true;
    await db.runSQLFile("clear.sql");
    await db.runSQLFile("init.sql");

    await testRoutines[testname]();

    globalConfig.auth.bypassEmailVerification = bypassEmailVerification_prev;
    testRunning = false;

    debugUtil.logRaw(`TEST ENDED (${testname})`);
}

module.exports = test;