import AuthUtil from "./authUtil";
import DebugUtil from "./debugUtil";
import EnvUtil from "./envUtil";
import FileUtil from "./fileUtil";
import UIConfig from "../../shared/config/uiConfig";
import TextUtil from "../../shared/util/textUtil";
import ejs from "ejs";
import dotenv from "dotenv";
import { Request } from "express";
dotenv.config();

const ejsPartialRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/partial`;

const baseStaticPageEJSParams = {
    EnvUtil, TextUtil, UIConfig,
    ejsPartialRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    EnvUtil, TextUtil, UIConfig,
    ejsPartialRootPath,
    isStaticPage: false,
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

        if (mergedEJSParams.globalDictionary)
            DebugUtil.log("'globalDictionary' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
        mergedEJSParams.globalDictionary = {};
        
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