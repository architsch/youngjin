import path from "path";
import fs from "fs/promises";
import FileUtil from "../util/fileUtil";
import { PET_LINES } from "../../agent/data/petLines";
import { PET_LINES_ASSET_PATH } from "../../../shared/object/maps/petLineMap";

// Writes what pets chat in (see PET_LINES) among the game's assets, for browsers to fetch once the game has loaded (see
// PetLineLoadUtil) rather than carry in its bundle; only when it has changed, so that browsers keep the copy they have.
export default class PetLinesBuilder
{
    async build(): Promise<void>
    {
        const filePath = FileUtil.getAbsoluteFilePath(`app/assets/${PET_LINES_ASSET_PATH}`);
        const text = JSON.stringify(PET_LINES);
        if (await fs.readFile(filePath, "utf8").catch(() => "") == text)
            return;
        await fs.mkdir(path.dirname(filePath), {recursive: true});
        await fs.writeFile(filePath, text);
    }
}
