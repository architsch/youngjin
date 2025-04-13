const envUtil = require("./envUtil.js");
const fileUtil = require("./fileUtil.js");
const uiConfig = require("../../shared/config/uiConfig.mjs").uiConfig;
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
const ejs = require("ejs");
require("dotenv").config();

const baseStaticPageEJSParams = {
    envUtil: envUtil,
    textUtil: textUtil,
    uiConfig: uiConfig,
    ejsChunkRootPath: `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`,
    isStaticPage: true,
};
const baseDynamicPageEJSParams = {
    envUtil: envUtil,
    textUtil: textUtil,
    uiConfig: uiConfig,
    ejsChunkRootPath: `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`,
    isStaticPage: false,
};

const cachedEJSStrings = {}; // [key]: relativeEJSFilePath, [value]: ejsString

const ejsUtil =
{
    makeEJSParams: (customEJSParams, isStaticPage = false) => {
        const mergedEJSParams = {};
        Object.assign(mergedEJSParams, isStaticPage ? baseStaticPageEJSParams : baseDynamicPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);
        return mergedEJSParams;
    },
    createStaticHTMLFromEJS: async (relativeEJSFilePath, customEJSParams = {}) =>
    {
        let ejsString = cachedEJSStrings[relativeEJSFilePath];
        if (ejsString == undefined)
        {
            ejsString = await fileUtil.read(relativeEJSFilePath, process.env.VIEWS_ROOT_DIR);
            cachedEJSStrings[relativeEJSFilePath] = ejsString;
        }

        const template = ejs.compile(ejsString);
        const htmlString = template(ejsUtil.makeEJSParams(customEJSParams, true));
        return htmlString;
    },
}

module.exports = ejsUtil;