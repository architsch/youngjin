const path = require('path');
const fs = require('fs/promises');
require("dotenv").config();

const fileUtil =
{
    read: async (relativeFilePath, rootDir = undefined) =>
    {
        try
        {
            const absoluteFilePath = getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Reading ---> ${absoluteFilePath}`);
            const data = await fs.readFile(absoluteFilePath, {encoding: 'utf8'});
            return data;
        }
        catch (err)
        {
            console.error(`fileUtil.js :: Failed to read file (relativeFilePath = "${relativeFilePath}") :: ${err}`);
            return "";
        }
    },
    write: async (relativeFilePath, content, rootDir = undefined) =>
    {
        try
        {
            const absoluteFilePath = getAbsoluteFilePath(relativeFilePath, rootDir);
            //console.log(`Writing ---> ${absoluteFilePath}`);
            await fs.writeFile(absoluteFilePath, content);
        }
        catch (err)
        {
            console.error(`fileUtil.js :: Failed to write file (relativeFilePath = "${relativeFilePath}") :: ${err}`);
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