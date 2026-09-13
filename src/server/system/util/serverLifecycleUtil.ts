// Graceful-shutdown flag, so /health reports not-ready until the process exits.

let shuttingDown = false;

const ServerLifecycleUtil =
{
    isShuttingDown: (): boolean => shuttingDown,

    // Returns false if already shutting down (process managers may send several signals).
    beginShutdown: (): boolean =>
    {
        if (shuttingDown)
            return false;
        shuttingDown = true;
        return true;
    },
}

export default ServerLifecycleUtil;
