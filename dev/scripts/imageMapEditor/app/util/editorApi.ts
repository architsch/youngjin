import EditorState from "../../core/editorState";
import SaveEntryRequest from "../../core/saveEntryRequest";
import SourceEntry from "../../core/sourceEntry";
import SourcePrep from "../../core/sourcePrep";
import PrepPreview from "../../core/prepPreview";

// The editor's server (see node/editorServer.ts).
const EditorApi =
{
    loadState: async (): Promise<EditorState> =>
    {
        return (await request("/api/state")).json();
    },

    // Refused (conflict) when the map is no longer the state baseHash names; the current one comes back.
    saveEntry: async (saveRequest: SaveEntryRequest):
        Promise<{path: string, state: EditorState} | {conflict: EditorState}> =>
    {
        const response = await request("/api/entries", {method: "PUT", headers: {"Content-Type": "application/json"},
            body: JSON.stringify(saveRequest)}, [409]);
        return (response.status == 409) ? {conflict: (await response.json()).state} : response.json();
    },

    deleteEntry: async (path: string, baseHash: string): Promise<{state: EditorState} | {conflict: EditorState}> =>
    {
        const query = new URLSearchParams({path, baseHash});
        const response = await request(`/api/entries?${query}`, {method: "DELETE"}, [409]);
        return (response.status == 409) ? {conflict: (await response.json()).state} : response.json();
    },

    // Into the source library, stored by its bytes (which is how a recipe names it).
    uploadSource: async (file: Blob, fileName: string): Promise<SourceEntry> =>
    {
        const response = await request("/api/sources", {method: "POST", body: file,
            headers: {"Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(fileName)}});
        return response.json();
    },

    // Into the source library, from a photo's page or an image's address.
    downloadSource: async (source: string): Promise<SourceEntry> =>
    {
        const response = await request("/api/sources/download", {method: "POST",
            headers: {"Content-Type": "application/json"}, body: JSON.stringify({source})});
        return response.json();
    },

    // Refused while an entry is sampled from it.
    deleteSource: async (sha1: string): Promise<{state: EditorState}> =>
    {
        return (await request(`/api/sources/${sha1}`, {method: "DELETE"})).json();
    },

    // What a source would be preprocessed into (see SourcePreprocessor). needsTools: cutting out would first fetch
    // its model, which fetchTools allows; it is the question to put to the user.
    previewPreparedSource: async (sha1: string, prep: SourcePrep, fetchTools: boolean):
        Promise<PrepPreview | {needsTools: string}> =>
    {
        const response = await request(`/api/sources/${sha1}/prepared/preview`, {method: "POST",
            headers: {"Content-Type": "application/json"}, body: JSON.stringify({prep, fetchTools})}, [428]);
        return (response.status == 428) ? {needsTools: await response.text()} : response.json();
    },

    // The source preprocessed and added to the library beside it; refused as a preview is.
    addPreparedSource: async (sha1: string, prep: SourcePrep, fetchTools: boolean):
        Promise<SourceEntry | {needsTools: string}> =>
    {
        const response = await request(`/api/sources/${sha1}/prepared`, {method: "POST",
            headers: {"Content-Type": "application/json"}, body: JSON.stringify({prep, fetchTools})}, [428]);
        return (response.status == 428) ? {needsTools: await response.text()} : response.json();
    },

    // Undefined if it isn't on this machine.
    fetchSource: async (sha1: string): Promise<Blob | undefined> =>
    {
        const response = await request(`/api/sources/${sha1}`, undefined, [404]);
        return (response.status == 404) ? undefined : response.blob();
    },

    getSourceURL: (sha1: string): string =>
    {
        return `/api/sources/${sha1}`;
    },

    getSourceThumbnailURL: (sha1: string): string =>
    {
        return `/api/sources/${sha1}/thumbnail`;
    },

    // An entry's full-resolution sample, if it has one.
    fetchSample: async (path: string): Promise<Blob | undefined> =>
    {
        const response = await request(`/api/samples/${path}.webp`, undefined, [404]);
        return (response.status == 404) ? undefined : response.blob();
    },

    getGameImageURL: (path: string, version: string): string =>
    {
        return `/api/images/${path}.webp?v=${version}`;
    },

    // The map or the source library changed on disk (by the editor's own saves too), a rebuild of the map finished,
    // or the page was rebuilt.
    subscribe: (onStateChanged: () => void, onMapRebuilt: (error: string | null) => void,
        onBundleChanged: () => void): () => void =>
    {
        const events = new EventSource("/api/events");
        events.addEventListener("state", () => onStateChanged());
        events.addEventListener("map", (event) => onMapRebuilt(JSON.parse((event as MessageEvent).data).error));
        events.addEventListener("bundle", () => onBundleChanged());
        return () => events.close();
    },
}

async function request(url: string, init?: RequestInit, allowedStatuses: number[] = []): Promise<Response>
{
    const response = await fetch(url, init);
    if (!response.ok && !allowedStatuses.includes(response.status))
        throw new Error(await response.text() || `${response.status} ${response.statusText}`);
    return response;
}

export default EditorApi;
