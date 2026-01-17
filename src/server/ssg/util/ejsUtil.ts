import ServerLogUtil from "../../networking/util/serverLogUtil";
import FileUtil from "./fileUtil";
import UIConfig from "../../../shared/embeddedScripts/config/uiConfig";
import TextUtil from "../../../shared/embeddedScripts/util/textUtil";
import ejs from "ejs";
import dotenv from "dotenv";
import { Request, Response } from "express";
import AddressUtil from "../../networking/util/addressUtil";
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
            const ip = AddressUtil.getLocalIpAddress();
            html = html
                .replaceAll("\n", "!*NEW_LINE*!")
                .replace(/(PROD_CODE_BEGIN).*?(PROD_CODE_END)/g, "REMOVED_PROD_CODE")
                .replaceAll("!*NEW_LINE*!", "\n")
                .replaceAll(process.env.URL_STATIC as string, `http://${ip}:${process.env.PORT}`) // In dev mode, the dynamic server will also play the role of the static server simultaneously.
                .replaceAll(process.env.URL_DYNAMIC as string, `http://${ip}:${process.env.PORT}`);
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

        if (mergedEJSParams.userString)
            ServerLogUtil.log("'userString' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
        mergedEJSParams.userString = (req as any).userString;

        if (mergedEJSParams.globalDictionary)
            ServerLogUtil.log("'globalDictionary' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "pink");
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