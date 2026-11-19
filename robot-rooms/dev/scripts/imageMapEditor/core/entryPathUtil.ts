import ImageEntry from "./imageEntry";

// Paths are "{subfolder}/{number}", and a stored canvas or prop names its image by one, so a path is never reused.
const EntryPathUtil =
{
    getSubfolder: (path: string): string =>
    {
        const slashIndex = path.indexOf("/");
        return (slashIndex < 0) ? "" : path.substring(0, slashIndex);
    },

    // One past the highest number the subfolder has ever used, retired ones included.
    getNextPath: (subfolder: string, entries: ImageEntry[], retiredPaths: string[]): string =>
    {
        let highest = 0;
        for (const path of [...entries.map(entry => entry.path), ...retiredPaths])
        {
            if (EntryPathUtil.getSubfolder(path) != subfolder)
                continue;
            const number = parseInt(path.substring(subfolder.length + 1));
            if (!isNaN(number))
                highest = Math.max(highest, number);
        }
        return `${subfolder}/${highest + 1}`;
    },
}

export default EntryPathUtil;
