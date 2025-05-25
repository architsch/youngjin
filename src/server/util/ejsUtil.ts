import authUtil from "./authUtil";
import debugUtil from "./debugUtil";
import envUtil from "./envUtil";
import fileUtil from "./fileUtil";
import uiConfig from "../config/uiConfig";
import textUtil from "../../shared/util/textUtil";
import ejs from "ejs";
import dotenv from "dotenv";
import { Request } from "express";
dotenv.config();

const ejsChunkRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`;
const ejsEmbeddedScriptRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/embeddedScript`;

const baseStaticPageEJSParams = {
    envUtil: envUtil,
    textUtil: textUtil,
    uiConfig: uiConfig,
    ejsChunkRootPath,
    ejsEmbeddedScriptRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    envUtil: envUtil,
    textUtil: textUtil,
    uiConfig: uiConfig,
    ejsChunkRootPath,
    ejsEmbeddedScriptRootPath,
    isStaticPage: false,
};

const cachedEJSStrings: {[relativeEJSFilePath: string]: string} = {};

const ejsUtil =
{
    makeEJSParams: (req: Request, userIsOptional: boolean,
        customEJSParams: {[key: string]: any}): {[key: string]: any} =>
    {
        const mergedEJSParams: {[key: string]: any} = {};
        Object.assign(mergedEJSParams, baseDynamicPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);

        if (mergedEJSParams.user)
            debugUtil.log("'user' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
        mergedEJSParams.user = authUtil.getUserFromReqToken(req, userIsOptional);
        return mergedEJSParams;
    },
    makeEJSParamsStatic: (customEJSParams: {[key: string]: any}): {[key: string]: any} => {
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
            ejsString = await fileUtil.read(relativeEJSFilePath, process.env.VIEWS_ROOT_DIR);
            cachedEJSStrings[relativeEJSFilePath] = ejsString;
        }

        const template = ejs.compile(ejsString);
        const htmlString = template(ejsUtil.makeEJSParamsStatic(customEJSParams));
        return htmlString;
    },
}

export default ejsUtil;