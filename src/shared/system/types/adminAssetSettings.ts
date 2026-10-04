import ImageMapSettings from "../../graphics/image/types/imageMapSettings";

// What an admin sets about the game's assets by hand, in the game, as the file at the assets' root holds it
// (ADMIN_ASSET_SETTINGS_FILE_NAME): saved from the game (see DebugStats), put in that file's place, and built into
// the game from there (see ImageMapBuilder). A saved one can also be taken back into the game, to go on from.
export default interface AdminAssetSettings
{
    // An image map's, under the name its module goes by (see ImageMapSettingsUtil.getMapKey).
    [imageMapKey: string]: ImageMapSettings | undefined;
}
