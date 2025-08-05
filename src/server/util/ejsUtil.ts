import AuthUtil from "./AuthUtil";
import DebugUtil from "./DebugUtil";
import EnvUtil from "./EnvUtil";
import FileUtil from "./FileUtil";
import UIConfig from "../../Shared/Config/UIConfig";
import TextUtil from "../../Shared/Util/TextUtil";
import ejs from "ejs";
import dotenv from "dotenv";
import { Request } from "express";
dotenv.config();

const ejsChunkRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`;
const ejsEmbeddedScriptRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/embeddedScript`;

const baseStaticPageEJSParams = {
    EnvUtil, TextUtil, UIConfig,
    ejsChunkRootPath,
    ejsEmbeddedScriptRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    EnvUtil, TextUtil, UIConfig,
    ejsChunkRootPath,
    ejsEmbeddedScriptRootPath,
    isStaticPage: false,
    embeddedScripts: ["Util/TextUtil.ejs", "Config/UIConfig.ejs"],
};

const cachedEJSStrings: {[relativeEJSFilePath: string]: string} = {};

const EJSUtil =
{
    makeEJSParams: (req: Request, userIsOptional: boolean,
        customEJSParams: {[key: string]: any}): {[key: string]: any} =>
    {
        const mergedEJSParams: {[key: string]: any} = {};
        Object.assign(mergedEJSParams, baseDynamicPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);

        if (mergedEJSParams.user)
            DebugUtil.log("'user' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
        mergedEJSParams.user = AuthUtil.getUserFromReqToken(req, userIsOptional);
        return mergedEJSParams;
    },
    makeEJSParamsStatic: (customEJSParams: {[key: string]: any}): {[key: string]: any} =>
    {
        const mergedEJSParams = {};
        Object.assign(mergedEJSParams, baseStaticPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);
        return mergedEJSParams;
    },
    createStaticHTMLFromEJS: async (relativeEJSFilePath: string,
        customEJSParams: {[key: string]: any} = {}): Promise<string> =>
    {
        let ejsString = cachedEJSStrings[relativeEJSFilePath];
        if (ejsString == undefined)
        {
            ejsString = await FileUtil.read(relativeEJSFilePath, process.env.VIEWS_ROOT_DIR);
            cachedEJSStrings[relativeEJSFilePath] = ejsString;
        }

        const template = ejs.compile(ejsString);
        const htmlString = template(EJSUtil.makeEJSParamsStatic(customEJSParams));
        return htmlString;
    },
}

export default EJSUtil;