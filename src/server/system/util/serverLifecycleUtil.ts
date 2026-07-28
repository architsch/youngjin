// Tracks whether this process has begun its graceful shutdown.
//
// The flag exists so that the health route can answer "not ready" for the whole span between the
// shutdown signal arriving and the process actually exiting. Without it, a client polling for the
// next deployment's server can get a 200 back from the very process that is about to close its
// listener, reload into it, and then fail on the requests that follow.

let shuttingDown = false;

const ServerLifecycleUtil =
{
    isShuttingDown: (): boolean => shuttingDown,

    // Marks the start of the shutdown. Returns false if the shutdown was already under way, which
    // lets the caller ignore the redundant signal instead of running the save-and-disconnect work
    // a second time (a process manager may send more than one signal before the process exits).
    beginShutdown: (): boolean =>
    {
        if (shuttingDown)
            return false;
        shuttingDown = true;
        return true;
    },
}

export default ServerLifecycleUtil;
