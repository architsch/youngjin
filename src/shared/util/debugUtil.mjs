export const debugUtil =
{
    log: (eventTitle, eventDescObj = undefined) =>
    {
        let eventDesc = "";
        if (eventDescObj != undefined)
            eventDesc = " :: " + JSON.stringify(eventDescObj);
        console.log(`${debugUtil.getFuncCallPath(5, 1)} :: [${eventTitle}]${eventDesc}`);
    },
    getFuncCallPath: (pathLengthLimit = 1, numClosestParentFuncCallsToSkip = 0) =>
    {
        const callingFunctionNames = new Error().stack
            .split("\n") // split the stack trace into lines
            .filter(line => line.indexOf("at Object.") >= 0) // only retain lines which contain the phrase: "at Object."
            .map(line => { // extract calling function names from the lines
                const start = line.indexOf("at Object.") + 10;
                const line2 = line.substring(start);
                const end = line2.indexOf(" ");
                return line2.substring(0, end);
            });
        
        callingFunctionNames.shift(); // remove the first element because it corresponds to the current function.
        for (let i = 0; i < numClosestParentFuncCallsToSkip; ++i)
            callingFunctionNames.shift();
        callingFunctionNames.reverse();
        while (callingFunctionNames.length > pathLengthLimit)
            callingFunctionNames.shift();
        return callingFunctionNames.join(" -> ");
    }
}