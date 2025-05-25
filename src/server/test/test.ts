import envUtil from "../util/envUtil";
import db from "../db/db";
import globalConfig from "../config/globalConfig";
import testHTTP from "./testHTTP";
import testRoutine from "./testRoutine/testRoutine";
import testDB from "./testDB";
import debugUtil from "../util/debugUtil";
import dependencyInjector from "../dependencyInjector";
import dotenv from "dotenv";
dotenv.config();

let testRunning = false;

async function test(testname: string, thresholdLogLevelName: string): Promise<void>
{
    if (!envUtil.isDevMode())
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - You are not allowed to run tests on a non-dev mode.`, "high", "pink");
        return;
    }
    if (testRunning)
    {
        debugUtil.logRaw(`TEST REJECTED (${testname}) - There is another test running.`, "high", "pink");
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
        debugUtil.logRaw(`Test routine "${testname}" not found.`, "high", "pink");
        return;
    }
    await routine();

    debugUtil.setThresholdLogLevel(thresholdLogLevel_prev);
    globalConfig.auth.bypassEmailVerification = bypassEmailVerification_prev;
    testRunning = false;

    debugUtil.logRaw(`TEST ENDED (${testname})`, "high");
}

export default test;
dependencyInjector.test = test;