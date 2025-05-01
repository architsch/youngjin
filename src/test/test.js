const envUtil = require("../server/util/envUtil.js");
const db = require("../server/db/db.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
const testHTTP = require("./testHTTP.js");
const testRoutines = require("./testRoutines.js");
const testDB = require("./testDB.js");
require("dotenv").config();

let testRunning = false;

async function test(testname)
{
    if (!envUtil.isDevMode())
    {
        console.error(`TEST REJECTED (${testname}) :: You are not allowed to run tests on a non-dev mode.`);
        return;
    }
    if (testRunning)
    {
        console.error(`TEST REJECTED (${testname}) :: There is another test running.`);
        return;
    }

    for (let i = 0; i < 5; ++i)
        console.log(" ");
    console.log("==================================================");
    console.log(`TEST STARTED (${testname})`);
    console.log("==================================================");
    console.log(" ");

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

    console.log(" ");
    console.log("==================================================");
    console.log(`TEST ENDED (${testname})`);
    console.log("==================================================");
    console.log(" ");
}

module.exports = test;