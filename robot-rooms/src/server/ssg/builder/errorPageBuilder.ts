import { STATIC_PAGE_ROOT_DIR, VIEWS_ROOT_DIR } from "../../system/serverConstants";
import EJSUtil from "../util/ejsUtil";
import FileUtil from "../util/fileUtil";

// The game's error pages, which the static site serves (and Nginx, the one shown while the server restarts).
export default class ErrorPageBuilder
{
    async build(sourceDir?: string, targetDir?: string): Promise<void>
    {
        if (sourceDir == undefined)
            sourceDir = `${VIEWS_ROOT_DIR}/page/static/error`;
        if (targetDir == undefined)
            targetDir = `${STATIC_PAGE_ROOT_DIR}/error`;

        let relativeFilePaths = await FileUtil.getAllRelativePathsInDirRecursively(sourceDir);
        relativeFilePaths = relativeFilePaths.filter(x => x.endsWith(".ejs"));

        for (const relativeFilePath of relativeFilePaths)
        {
            const html = await EJSUtil.createStaticHTMLFromEJS("/page/static/error/" + relativeFilePath, {});
            await FileUtil.write(relativeFilePath.replace(".ejs", ".html"), html, targetDir);
        }
    }
}
