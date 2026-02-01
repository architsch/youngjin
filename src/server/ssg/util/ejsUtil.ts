import FileUtil from "./fileUtil";
import ejs from "ejs";
import { Request, Response } from "express";
import AddressUtil from "../../networking/util/addressUtil";
import { URL_DYNAMIC, URL_STATIC, VIEWS_ROOT_DIR } from "../../system/serverConstants";
import { PAGE_NAME_MAP } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const ejsPartialRootPath = `${process.env.PWD}/${VIEWS_ROOT_DIR}/partial`;

const baseStaticPageEJSParams = {
    PAGE_NAME_MAP,
    URL_STATIC, URL_DYNAMIC,
    ejsPartialRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    URL_STATIC, URL_DYNAMIC,
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
                .replaceAll(URL_STATIC as string, AddressUtil.getEnvStaticURL()) // In dev mode, the dynamic server will also play the role of the static server simultaneously.
                .replaceAll(URL_DYNAMIC as string, AddressUtil.getEnvDynamicURL());
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
            LogUtil.log("'userString' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "error");
        mergedEJSParams.userString = (req as any).userString;

        if (mergedEJSParams.globalDictionary)
            LogUtil.log("'globalDictionary' shouldn't be defined manually in EJS params.", {mergedEJSParams}, "high", "error");
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
            ejsString = await FileUtil.read(relativeEJSFilePath, VIEWS_ROOT_DIR);
            cachedEJSStrings[relativeEJSFilePath] = ejsString;
        }

        const template = ejs.compile(ejsString);
        const htmlString = template(EJSUtil.makeEJSParamsStatic(customEJSParams));
        return htmlString;
    },
}

export default EJSUtil;