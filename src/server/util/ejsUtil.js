const envUtil = require("./envUtil.js");
const fileUtil = require("./fileUtil.js");
const ejs = require("ejs");
require("dotenv").config();

const cachedEJSStrings = {}; // [key]: relativeEJSFilePath, [value]: ejsString

const ejsUtil =
{
    createHTMLStringFromEJS: async (relativeEJSFilePath, ejsViewParams = {}) =>
    {
        const augmentedParams = {
            envUtil: envUtil,
        };
        Object.assign(augmentedParams, ejsViewParams);

        let ejsString = cachedEJSStrings[relativeEJSFilePath];
        if (ejsString == undefined)
        {
            ejsString = await fileUtil.read(relativeEJSFilePath, process.env.VIEWS_ROOT_DIR);
            cachedEJSStrings[relativeEJSFilePath] = ejsString;
        }
        const template = ejs.compile(ejsString);
        const htmlString = template(augmentedParams);
        return htmlString;
    },
}

module.exports = ejsUtil;