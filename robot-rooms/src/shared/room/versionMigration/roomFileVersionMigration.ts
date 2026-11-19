import RoomPrefsVersionMigration from "./roomPrefsVersionMigration";

// Index N converts a room file's settings from version N to N+1. Its contents are converted by versions of their own
// (see VoxelGrid, ObjectGroup).
const prefsConverters: ((prefs: string) => string)[] = [
    RoomPrefsVersionMigration.convertToAtmospherePalette, // version 0 -> 1
];

const RoomFileVersionMigration =
{
    // The settings a file of the given version holds, as the latest version reads them.
    convertPrefs: (prefs: string, versionFound: number): string =>
    {
        let converted = prefs;
        for (let version = versionFound; version < prefsConverters.length; ++version)
            converted = prefsConverters[version](converted);
        return converted;
    },
}

export default RoomFileVersionMigration;
