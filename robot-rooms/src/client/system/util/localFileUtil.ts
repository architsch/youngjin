// How long a download's object URL is kept, which has to outlast the browser starting to read it.
const DOWNLOAD_URL_LIFETIME_MS = 60 * 1000;

// Files on the user's own machine, chosen in the browser's file browser. Both calls have to come straight
// from a click: a browser opens its file browser only on the user's own gesture.
const LocalFileUtil =
{
    // Asks where to save, then writes the file there. False if the user backed out.
    save: async (bytes: ArrayBuffer, suggestedName: string, extension: string,
        description: string): Promise<boolean> =>
    {
        const blob = new Blob([bytes], {type: "application/octet-stream"});

        // Without the picker (anything but Chromium), the browser's own download decides where it goes.
        if (window.showSaveFilePicker == undefined)
        {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = suggestedName;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
            return true;
        }

        let fileHandle: FileSystemFileHandle;
        try
        {
            fileHandle = await window.showSaveFilePicker({suggestedName,
                types: [{description, accept: {"application/octet-stream": [extension]}}]});
        }
        catch (err)
        {
            // Dismissing the picker is reported as an AbortError.
            if (err instanceof DOMException && err.name == "AbortError")
                return false;
            throw err;
        }
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
    },
    // Asks which file to read. Null if the user backed out.
    pick: (extension: string): Promise<File | null> =>
    {
        return new Promise(resolve => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = extension;
            input.style.display = "none";
            const finish = (file: File | null) => {
                input.remove();
                resolve(file);
            };
            input.onchange = () => finish(input.files?.[0] ?? null);
            input.oncancel = () => finish(null);

            // Kept in the page while the file browser is up: a detached input can be collected before
            // it answers.
            document.body.appendChild(input);
            input.click();
        });
    },
}

export default LocalFileUtil;
