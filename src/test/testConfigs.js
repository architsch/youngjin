const testConfigs =
{
    "default": () => {
        const testConfig = { steps: [] };
        const numUsers = 5;
        
        for (let i = 0; i < numUsers; ++i)
        {
            testConfig.steps.push({
                name: "initUser",
                args: {
                    userName: `testuser${i}`,
                    password: `testpass${i}`,
                    email: `test${i}@test.com`,
                }
            });
        }
        return testConfig;
    },
}

module.exports = testConfigs;