import DebugUtil from "./debugUtil";
import FileUtil from "./fileUtil";
import UIConfig from "../../shared/embeddedScripts/config/uiConfig";
import TextUtil from "../../shared/embeddedScripts/util/textUtil";
import ejs from "ejs";
import dotenv from "dotenv";
import { Request, Response } from "express";
dotenv.config();

const ejsPartialRootPath = `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/partial`;

const baseStaticPageEJSParams = {
    TextUtil, UIConfig,
    ejsPartialRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    TextUtil, UIConfig,
    ejsPartialRootPath,
    isStaticPage: false,
};

const cachedEJSStrings: {[relativeEJSFilePath: string]: string} = {};

const EJSUtil =
{
    render: (req: Request, res: Response, ejsViewPath: string,
        customEJSParams: {[key: string]: any}): void =>
    {
        res.render(ejsViewPath, EJSUtil.makeEJSParams(req, customEJSParams), (err: Error, html: string) => {
            if (err)
            {
                res.status(500).send(err.message);
            }
            else
            {
                html = EJSUtil.postProcessHTML(html);
                res.status(200).setHeader("content-type", "text/html").send(html);
            }
        });
    },
    postProcessHTML: (html: string): string => {
        if (process.env.MODE == "dev")
        {
            html = html
                .replaceAll("\n", "!*NEW_LINE*!")
                .replace(/(PROD_CODE_BEGIN).*?(PROD_CODE_END)/g, "REMOVED_PROD_CODE")
                .replaceAll("!*NEW_LINE*!", "\n")
                .replaceAll(process.env.URL_STATIC as string, `http://localhost:${process.env.PORT}`) // In dev mode, the dynamic server will also play the role of the static server simultaneously.
                .replaceAll(process.env.URL_DYNAMIC as string, `http://localhost:${process.env.PORT}`);
            return html;
        }
        else
        {
            return html;
        }
    },
    makeEJSParams: (req: Request, customEJSParams: {[key: string]: any}): {[key: string]: any} =>
    {
        const mergedEJSParams: {[key: string]: any} = {};
        Object.assign(mergedEJSParams, baseDynamicPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);

        if (mergedEJSParams.user)
            DebugUtil.log("'user' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
        mergedEJSParams.user = (req as any).user;

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