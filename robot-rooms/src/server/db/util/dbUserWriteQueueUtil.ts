// The last write queued for each user, while it is still under way.
const tails = new Map<string, Promise<void>>();

// Writes of one user's row that must land in the order they were made (their player's metadata as they leave a room,
// their pets as they buy or sell one; see ServerUserManager, PetServerUtil): requests sent to the database together
// may arrive in any order, and an older one arriving last would undo the newer.
const DBUserWriteQueueUtil =
{
    // Runs a write once every write queued for the user before it has finished, whether or not those succeeded.
    run: (userID: string, write: () => Promise<unknown>): Promise<void> =>
    {
        const settled = (tails.get(userID) ?? Promise.resolve()).then(write).then(() => {}, () => {});
        tails.set(userID, settled);
        void settled.then(() => {
            if (tails.get(userID) === settled)
                tails.delete(userID);
        });
        return settled;
    },
    // Once every write queued for the user so far has finished: for a read of their row that must not miss one.
    settle: (userID: string): Promise<void> =>
    {
        return tails.get(userID) ?? Promise.resolve();
    },
    // Once everything queued so far has finished: for what writes users' rows all at once (the shutdown's save).
    drain: async (): Promise<void> =>
    {
        await Promise.all([...tails.values()]);
    },
}

export default DBUserWriteQueueUtil;
