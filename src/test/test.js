const envUtil = require("../server/util/envUtil.js");
const db = require("../server/db/db.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
const testHTTP = require("./testHTTP.js");
const testRoutine = require("./testRoutine/testRoutine.js");
const testDB = require("./testDB.js");
const debugUtil = require("../server/util/debugUtil.js");
require("dotenv").config();

let testRunning = false;

async function test(testname, thresholdLogLevelName)
{
    if (!envUtil.isDevMode())
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - You are not allowed to run tests on a non-dev mode.`, "high");
        return;
    }
    if (testRunning)
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - There is another test running.`, "high");
        return;
    }

    debugUtil.logRaw(`TEST STARTED (${testname})`, "high");

    testRunning = true;
    testHTTP._reset();
    testDB._reset();
    const bypassEmailVerification_prev = globalConfig.auth.bypassEmailVerification;
    globalConfig.auth.bypassEmailVerification = true;
    const thresholdLogLevel_prev = debugUtil.getThresholdLogLevel();
    debugUtil.setThresholdLogLevel(thresholdLogLevelName);
    
    await db.runSQLFile("clear.sql");
    await db.runSQLFile("init.sql");

    const routine = testRoutine[testname];
    if (!routine)
    {
        alert(`Test routine "${testname}" not found.`);
        return;
    }
    await routine();

    debugUtil.setThresholdLogLevel(thresholdLogLevel_prev);
    globalConfig.auth.bypassEmailVerification = bypassEmailVerification_prev;
    testRunning = false;

    debugUtil.logRaw(`TEST ENDED (${testname})`, "high");
}

module.exports = test;