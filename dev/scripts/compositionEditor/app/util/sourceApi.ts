// The editor's server (see server.js): the source file as text with a hash of it, and a stream of changes.
const SourceApi =
{
    // path: relative to the repository.
    load: async (): Promise<{text: string, hash: string, path: string}> =>
    {
        const response = await fetch("/api/source");
        if (!response.ok)
            throw new Error(`Could not load the source (${response.status} ${await response.text()})`);
        return response.json();
    },

    // Refused (conflict) when the file is no longer the one baseHash names; the current one comes back.
    save: async (text: string, baseHash: string):
        Promise<{hash: string, conflict?: undefined} | {conflict: {text: string, hash: string}}> =>
    {
        const response = await fetch("/api/source", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({text, baseHash}),
        });
        if (response.status == 409)
            return {conflict: await response.json()};
        if (!response.ok)
            throw new Error(`Could not save the source (${response.status} ${await response.text()})`);
        return response.json();
    },

    // The file changed on disk (by the editor's own saves too), or the editor's code was rebuilt.
    subscribe: (onSourceChanged: (hash: string) => void, onBundleChanged: () => void): () => void =>
    {
        const events = new EventSource("/api/events");
        events.addEventListener("source", (event) => onSourceChanged(JSON.parse((event as MessageEvent).data).hash));
        events.addEventListener("bundle", () => onBundleChanged());
        return () => events.close();
    },
}

export default SourceApi;
