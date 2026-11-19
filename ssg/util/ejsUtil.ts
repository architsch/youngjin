import path from "node:path";
import fs from "node:fs/promises";
import ejs from "ejs";
import { PAGE_NAME_MAP, URL_ROBOT_ROOMS, URL_STATIC, VIEWS_DIR } from "../siteConstants.ts";

const ejsPartialRootPath = path.join(VIEWS_DIR, "partial");

const baseEJSParams = {
    PAGE_NAME_MAP,
    URL_STATIC, URL_ROBOT_ROOMS,
    ejsPartialRootPath,
};

const EJSUtil =
{
    createStaticHTMLFromEJS: async (relativeEJSFilePath: string,
        customEJSParams: {[key: string]: any} = {}): Promise<string> =>
    {
        const ejsString = await fs.readFile(path.join(VIEWS_DIR, relativeEJSFilePath), {encoding: "utf8"});
        const template = ejs.compile(ejsString);
        return template({...baseEJSParams, ...customEJSParams});
    },
}

export default EJSUtil;
