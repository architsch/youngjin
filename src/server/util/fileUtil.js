const path = require('path');
const fs = require('fs/promises');
const debugUtil = require('./debugUtil.js');
require("dotenv").config();

const fileUtil =
{
    read: async (relativeFilePath, rootDir = undefined) =>
    {
        try {
            const absoluteFilePath = getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Reading ---> ${absoluteFilePath}`);
            const data = await fs.readFile(absoluteFilePath, {encoding: 'utf8'});
            return data;
        }
        catch (err) {
            debugUtil.log("Failed to read file", {relativeFilePath, err}, "high");
            return "";
        }
    },
    write: async (relativeFilePath, content, rootDir = undefined) =>
    {
        try {
            const absoluteFilePath = getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Writing ---> ${absoluteFilePath}`);
            await fs.writeFile(absoluteFilePath, content);
        }
        catch (err) {
            debugUtil.log("Failed to write file", {relativeFilePath, err}, "high");
        }
    },
}

function getAbsoluteFilePath(relativeFilePath, rootDir = undefined)
{
    if (rootDir == undefined)
        rootDir = process.env.STATIC_PAGE_ROOT_DIR;
    return path.join(process.env.PWD, rootDir + "/" + relativeFilePath);
}

module.exports = fileUtil;