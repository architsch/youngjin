import path from "node:path";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { PUBLIC_DIR } from "../siteConstants.ts";

export const SOURCE_FILE_NAME = "source.txt";

// The site's folder, where sources are read and pages written: public/, unless a test names another.
let rootDir = PUBLIC_DIR;
// A check writes nothing, and only notes which files a build would change.
let checkOnly = false;
let fileCount = 0;
const changedFiles: string[] = [];

const FileUtil =
{
    // Starts a build over: where it reads and writes, whether it only checks, and its counts.
    configure: (options: {rootDir?: string, checkOnly?: boolean} = {}): void =>
    {
        rootDir = options.rootDir ?? PUBLIC_DIR;
        checkOnly = options.checkOnly ?? false;
        fileCount = 0;
        changedFiles.length = 0;
    },
    exists: (relativeFilePath: string): boolean =>
    {
        return existsSync(path.join(rootDir, relativeFilePath));
    },
    // The author's text that the pages of one folder are built from.
    readSource: async (dirName: string): Promise<string> =>
    {
        const absoluteFilePath = path.join(rootDir, dirName, SOURCE_FILE_NAME);
        if (!existsSync(absoluteFilePath))
            throw new Error(`${absoluteFilePath} is missing: the pages of "${dirName}" are built from it.`);
        return await fs.readFile(absoluteFilePath, {encoding: "utf8"});
    },
    // Leaves alone a file that already holds the content.
    write: async (relativeFilePath: string, content: string): Promise<void> =>
    {
        const absoluteFilePath = path.join(rootDir, relativeFilePath);
        fileCount++;
        const current = existsSync(absoluteFilePath)
            ? await fs.readFile(absoluteFilePath, {encoding: "utf8"})
            : undefined;
        if (current === content)
            return;
        changedFiles.push(relativeFilePath);
        if (!checkOnly)
            await fs.writeFile(absoluteFilePath, content);
    },
    getFileCount: (): number =>
    {
        return fileCount;
    },
    getChangedFiles: (): string[] =>
    {
        return [...changedFiles];
    },
}

export default FileUtil;
