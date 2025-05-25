import fileUtil from "../../util/fileUtil";
import dotenv from "dotenv";
dotenv.config();

export default class textFileBuilder
{
    private lines: string[] = [];

    addLine(line: string): void
    {
        this.lines.push(line);
    }

    getText(): string
    {
        return this.lines.join("\n");
    }

    async build(relativeFilePath: string, rootDir?: string): Promise<void>
    {
        if (rootDir == undefined)
            rootDir = process.env.STATIC_PAGE_ROOT_DIR;
        await fileUtil.write(relativeFilePath, this.lines.join("\n"), rootDir);
    }
}