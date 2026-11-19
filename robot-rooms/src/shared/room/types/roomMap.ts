import RoomFile from "./roomFile";

// Catalogs a set of room files under one directory of the assets, so the app can refer to each by a short,
// stable roomPath instead of a URL: the rooms' counterpart of ImageMap (see
// @docs/networking/single_player_mode.md).
export default class RoomMap
{
    private rootDirName: string;
    private roomPaths: string[];

    constructor(rootDirName: string, roomPaths: string[])
    {
        this.rootDirName = rootDirName;
        this.roomPaths = roomPaths;
    }

    hasRoomPath(path: string): boolean
    {
        return this.roomPaths.includes(path);
    }
    getRoomPaths(): string[]
    {
        return this.roomPaths;
    }
    // path: relative to the root directory (rootDirName under the assets URL), without extension.
    getRoomURLByPath(assetsURL: string, path: string): string
    {
        return `${assetsURL}/${this.rootDirName}/${path}${RoomFile.FILE_EXTENSION}`;
    }
}
