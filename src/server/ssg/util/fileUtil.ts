import path from "path";
import fs from "fs/promises";
import { STATIC_PAGE_ROOT_DIR } from "../../system/serverConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const FileUtil =
{
    read: async (relativeFilePath: string, rootDir?: string): Promise<string> =>
    {
        try {
            const absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Reading ---> ${absoluteFilePath}`);
            const data = await fs.readFile(absoluteFilePath, {encoding: 'utf8'});
            return data;
        }
        catch (err) {
            LogUtil.log("Failed to read file", {relativeFilePath, err}, "high", "error");
            return "";
        }
    },
    write: async (relativeFilePath: string, content: string, rootDir?: string): Promise<void> =>
    {
        try {
            const absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Writing ---> ${absoluteFilePath}`);
            await fs.writeFile(absoluteFilePath, content);
        }
        catch (err) {
            LogUtil.log("Failed to write file", {relativeFilePath, err} as any, "high", "error");
        }
    },
    getAllRelativePathsInDirRecursively: async (dir: string): Promise<string[]> =>
    {
        const absoluteDirPath = path.join(process.env.PWD as string, dir);
        const result: string[] = [];
        await FileUtil.getAllRelativePathsInDirRecursively_internal(absoluteDirPath, [], result);
        return result;
    },
    getAbsoluteFilePath(relativeFilePath: string, rootDir?: string): string
    {
        if (rootDir == undefined)
            rootDir = STATIC_PAGE_ROOT_DIR;
        return path.join(process.env.PWD as string, rootDir + "/" + relativeFilePath);
    },
    async getAllRelativePathsInDirRecursively_internal(
        absoluteDirPath: string, subDirs: string[], result: string[]): Promise<void>
    {
        const fileNames = await fs.readdir(absoluteDirPath);
        for (const fileName of fileNames)
        {
            const subDirsNew = subDirs.concat(fileName);
            const absoluteFilePath = `${absoluteDirPath}/${fileName}`;
            const lstat = await fs.lstat(absoluteFilePath);
            if (lstat.isFile())
                result.push(subDirsNew.join("/"));
            else
                await FileUtil.getAllRelativePathsInDirRecursively_internal(absoluteFilePath, subDirsNew, result);
        }
    }
}

export default FileUtil;