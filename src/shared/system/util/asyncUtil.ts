const AsyncUtil =
{
    waitUntilSuccess: async (successCond: () => boolean, timeoutInMillis: number)
        : Promise<boolean> =>
    {
        let timeoutRemaining = timeoutInMillis;
        while (!successCond())
        {
            await new Promise((resolve, reject) => setTimeout(resolve, 100)); // wait and retry
            timeoutRemaining -= 100;
            if (timeoutRemaining <= 0) // timeout
                break;
        }
        return successCond();
    },
}

export default AsyncUtil;