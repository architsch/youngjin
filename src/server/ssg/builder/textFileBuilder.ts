import FileUtil from "../../ssg/util/fileUtil";
import { STATIC_PAGE_ROOT_DIR } from "../../system/serverConstants";

export default class TextFileBuilder
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
            rootDir = STATIC_PAGE_ROOT_DIR;
        await FileUtil.write(relativeFilePath, this.lines.join("\n"), rootDir);
    }
}