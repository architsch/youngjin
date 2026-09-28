// How a source added by its address is downloaded, and what the download says of it (see SourceLibrary).
const SourceUrlUtil =
{
    // A photo's page on Unsplash ends in its id; its public download link gives a free photo's original (and
    // refuses an Unsplash+ one). Anything else is downloaded as it is.
    getUnsplashId: (url: string): string | undefined =>
    {
        const parsed = new URL(url);
        if (!parsed.hostname.endsWith("unsplash.com"))
            return undefined;
        const match = /([A-Za-z0-9_-]{11})\/?$/.exec(parsed.pathname);
        return match?.[1];
    },

    getDownloadUrl: (url: string): string =>
    {
        const unsplashId = SourceUrlUtil.getUnsplashId(url);
        return (unsplashId != undefined) ? `https://unsplash.com/photos/${unsplashId}/download?force=true` : url;
    },

    // Unsplash names the file it sends after the photographer ("inaki-del-olmo-<id>-unsplash.jpg"): their name,
    // though without its accents or capitals, so it is only a suggestion.
    getSuggestedAuthor: (downloadedUrl: string, unsplashId: string): string | undefined =>
    {
        const fileName = new URL(downloadedUrl).searchParams.get("dl") ?? "";
        const suffix = `-${unsplashId}-unsplash.jpg`;
        if (!fileName.endsWith(suffix) || fileName.length == suffix.length)
            return undefined;
        return fileName.slice(0, -suffix.length).split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    },
}

export default SourceUrlUtil;
