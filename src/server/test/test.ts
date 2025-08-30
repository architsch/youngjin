import DB from "../db/db";
import GlobalConfig from "../../shared/config/globalConfig";
import TestHTTP from "./testHTTP";
import TestRoutine from "./testRoutine/testRoutine";
import TestDB from "./testDB";
import DebugUtil from "../util/debugUtil";
import ServiceLocatorUtil from "../util/serviceLocatorUtil";
import dotenv from "dotenv";
dotenv.config();

let testRunning = false;

async function Test(testname: string, thresholdLogLevelName: string): Promise<void>
{
    if (testRunning)
    {
        DebugUtil.logRaw(`TEST REJECTED (${testname}) - There is another test running.`, "high", "pink");
        return;
    }

    DebugUtil.logRaw(`TEST STARTED (${testname})`, "high");

    testRunning = true;
    TestHTTP._reset();
    TestDB._reset();
    const bypassEmailVerification_prev = GlobalConfig.auth.bypassEmailVerification;
    GlobalConfig.auth.bypassEmailVerification = true;
    const thresholdLogLevel_prev = DebugUtil.getThresholdLogLevel();
    DebugUtil.setThresholdLogLevel(thresholdLogLevelName);
    
    await DB.runSQLFile("clear.sql");
    await DB.runSQLFile("init.sql");

    const routine = TestRoutine[testname];
    if (!routine)
    {
        DebugUtil.logRaw(`Test routine "${testname}" not found.`, "high", "pink");
        testRunning = false;
        return;
    }
    await routine();

    DebugUtil.setThresholdLogLevel(thresholdLogLevel_prev);
    GlobalConfig.auth.bypassEmailVerification = bypassEmailVerification_prev;
    testRunning = false;

    DebugUtil.logRaw(`TEST ENDED (${testname})`, "high");
}

export default Test;
ServiceLocatorUtil.add("test", Test);