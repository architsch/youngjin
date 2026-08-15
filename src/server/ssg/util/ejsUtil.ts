import FileUtil from "./fileUtil";
import ejs from "ejs";
import { Request, Response } from "express";
import AddressUtil from "../../networking/util/addressUtil";
import { IS_PUBLIC_SITE, URL_DYNAMIC, URL_STATIC, VIEWS_ROOT_DIR } from "../../system/serverConstants";
import { HEALTH_ROUTE_PATH, PAGE_NAME_MAP } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const ejsPartialRootPath = `${process.env.PWD}/${VIEWS_ROOT_DIR}/partial`;

// Everything a page marks as belonging to the public site alone — its share-preview metadata and
// its analytics tag. The character class, rather than a dot, is what lets the match run past the
// newlines such a block always spans.
const PROD_CODE_BLOCK_PATTERN = /PROD_CODE_BEGIN[\s\S]*?PROD_CODE_END/g;

const baseStaticPageEJSParams = {
    PAGE_NAME_MAP,
    HEALTH_ROUTE_PATH,
    URL_STATIC, URL_DYNAMIC,
    ejsPartialRootPath,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    HEALTH_ROUTE_PATH,
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
    // Applied to every page on its way out — both the ones rendered per request and, in dev mode,
    // the pre-generated static files (see Router). Deliberately not applied when those static files
    // are *generated*: they are generated in dev as well, and a build that quietly wrote away the
    // live site's own metadata would ship that loss the next time the public directory was
    // committed. Generation always emits the full page; what varies is what each deployment serves.
    postProcessHTML: (html: string): string => {
        let processedHTML = html;

        if (!IS_PUBLIC_SITE)
            processedHTML = processedHTML.replace(PROD_CODE_BLOCK_PATTERN, "REMOVED_PROD_CODE");

        // In dev mode, the dynamic server also plays the role of the static server.
        if (process.env.MODE == "dev")
        {
            processedHTML = processedHTML
                .replaceAll(URL_STATIC as string, AddressUtil.getEnvStaticURL())
                .replaceAll(URL_DYNAMIC as string, AddressUtil.getEnvDynamicURL())
                .replaceAll("#what-is-thingspool", "/index.html#what-is-thingspool")
                .replaceAll("#other-works", "/index.html#other-works");
        }

        return processedHTML;
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