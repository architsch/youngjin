import { ongoingClientProcessesObservable } from "../clientObservables";

// While there is at least 1 ongoing ClientProcess,
// the system should be showing a full-screen loading indicator UI as well as blocking
// any other major (i.e. network or system-related) actions.
export default interface ClientProcess
{
    numOngoingProcesses: number;
    lastProcessStartTime: number;
}

export function tryStartClientProcess(name: string,
    maxNumOngoingProcessesAllowed: number, minDelayBetweenProcessStartTimes: number): boolean
{
    const currTime = performance.now() * 0.001;

    return ongoingClientProcessesObservable.tryAdd(name, {
            numOngoingProcesses: 1, lastProcessStartTime: currTime
        }) ||
        ongoingClientProcessesObservable.tryUpdate(name,
            (existingProcess) => {
                existingProcess.numOngoingProcesses++;
                existingProcess.lastProcessStartTime = currTime;
                return existingProcess;
            },
            (existingProcess) => {
                return existingProcess.numOngoingProcesses < maxNumOngoingProcessesAllowed &&
                    currTime > existingProcess.lastProcessStartTime + minDelayBetweenProcessStartTimes;
            }
        );
}

export function endClientProcess(name: string): void
{
    const updated = ongoingClientProcessesObservable.tryUpdate(name,
            (existingProcess) => {
                existingProcess.numOngoingProcesses--;
                return existingProcess;
            },
            (existingProcess) => {
                return existingProcess.numOngoingProcesses > 0;
            }
        );
    if (!updated)
        throw new Error(`Failed to end client process "${name}" because there was no ongoing process registered.`);
}

export function ongoingClientProcessExists(name?: string): boolean
{
    const processMap = ongoingClientProcessesObservable.peek();
    if (name !== undefined)
    {
        const clientProcess = processMap[name];
        return clientProcess !== undefined && clientProcess.numOngoingProcesses > 0;
    }
    for (const clientProcess of Object.values(processMap))
    {
        if (clientProcess.numOngoingProcesses > 0)
            return true;
    }
    return false;
}