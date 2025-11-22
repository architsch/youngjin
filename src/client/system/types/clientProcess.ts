import { ongoingProcessesObservable } from "../observables";

export default interface ClientProcess
{
    numOngoingProcesses: number;
    lastProcessStartTime: number;
}

export function tryStartClientProcess(name: string,
    maxNumOngoingProcessesAllowed: number, minDelayBetweenProcessStartTimes: number): boolean
{
    const currTime = performance.now() * 0.001;

    return ongoingProcessesObservable.tryAdd(name, {
            numOngoingProcesses: 1, lastProcessStartTime: currTime
        }) ||
        ongoingProcessesObservable.tryUpdate(name,
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
    const updated = ongoingProcessesObservable.tryUpdate(name,
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