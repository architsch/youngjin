import fileUtil from "../../util/fileUtil";
import dotenv from "dotenv";
dotenv.config();

export default class embeddedScriptBuilder
{
    async build(sourceDir?: string, targetDir?: string): Promise<void>
    {
        if (sourceDir == undefined)
            sourceDir = `${process.env.SRC_ROOT_DIR}/shared`;
        if (targetDir == undefined)
            targetDir = `${process.env.VIEWS_ROOT_DIR}/embeddedScript`;

        let relativeFilePaths = await fileUtil.getAllRelativePathsInDirRecursively(sourceDir);
        relativeFilePaths = relativeFilePaths.filter(x => x.endsWith(".js"));

        for (const relativeFilePath of relativeFilePaths)
        {
            const sourceCode = await fileUtil.read(relativeFilePath, sourceDir);
            const sourceCodeWithoutExport = sourceCode
                .split("\n")
                .filter(line => !line.startsWith("export "))
                .join("\n").trim();
            await fileUtil.write(relativeFilePath.replace(".js", ".ejs"), "<script>\n" + sourceCodeWithoutExport + "\n</script>", targetDir);
        }
    }
}