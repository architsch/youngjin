import StringUtil from "../../math/util/stringUtil";
import AtmospherePaletteVersionMigration from "../../math/versionMigration/atmospherePaletteVersionMigration";

// Where the prefs string holds the colors the legacy "Fog" palette painted (the fog, the sky) and the legacy "Scenery"
// one painted (the clouds, the ground's low and its peaks); see RoomPrefsUtil.
const FOG_COLOR_CHAR_INDEX = 3;
const SKY_COLOR_CHAR_INDEX = 23;
const CLOUD_COLOR_CHAR_INDEX = 7;
const GROUND_COLOR_CHAR_INDEX = 12;
const GROUND_PEAK_COLOR_CHAR_INDEX = 13;

// Converts a room's settings, which carry no version of their own, for the stored formats that date them (see
// DBRoomVersionMigration, RoomFileVersionMigration).
const RoomPrefsVersionMigration =
{
    // The fog, sky, cloud and ground colors carried over to the "Atmosphere" palette. A color a string is too short
    // to hold is left out as it was: it reads back a default that is the same color in both palettes, or the fog's.
    convertToAtmospherePalette: (prefs: string): string =>
    {
        let converted = convertChar(prefs, FOG_COLOR_CHAR_INDEX, AtmospherePaletteVersionMigration.convertFogColorIndex);
        converted = convertChar(converted, SKY_COLOR_CHAR_INDEX, AtmospherePaletteVersionMigration.convertFogColorIndex);
        converted = convertChar(converted, CLOUD_COLOR_CHAR_INDEX,
            AtmospherePaletteVersionMigration.convertSceneryColorIndex);
        if (prefs.length <= GROUND_PEAK_COLOR_CHAR_INDEX)
        {
            return convertChar(converted, GROUND_COLOR_CHAR_INDEX,
                AtmospherePaletteVersionMigration.convertSceneryColorIndex);
        }
        const [ground, peak] = AtmospherePaletteVersionMigration.convertSceneryColorPair(
            StringUtil.convertVisibleASCIIToRawNumber(prefs, GROUND_COLOR_CHAR_INDEX),
            StringUtil.convertVisibleASCIIToRawNumber(prefs, GROUND_PEAK_COLOR_CHAR_INDEX));
        converted = replaceChar(converted, GROUND_COLOR_CHAR_INDEX, ground);
        return replaceChar(converted, GROUND_PEAK_COLOR_CHAR_INDEX, peak);
    },
}

function convertChar(prefs: string, charIndex: number, convertIndex: (legacyIndex: number) => number): string
{
    if (charIndex >= prefs.length)
        return prefs;
    return replaceChar(prefs, charIndex, convertIndex(StringUtil.convertVisibleASCIIToRawNumber(prefs, charIndex)));
}

function replaceChar(prefs: string, charIndex: number, index: number): string
{
    return prefs.substring(0, charIndex) + StringUtil.convertRawNumberToVisibleASCII(index)
        + prefs.substring(charIndex + 1);
}

export default RoomPrefsVersionMigration;
