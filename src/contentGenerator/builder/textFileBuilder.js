const fileUtil = require("../../server/util/fileUtil.js");
const envUtil = require("../../server/util/envUtil.js");
require("dotenv").config();

function TextFileBuilder()
{
    const lines = [];

    this.addLine = (line) => {
        lines.push(line);
    };

    this.getText = () => {
        return lines.join("\n");
    };

    this.build = async (relativeFilePath, rootDir = undefined) => {
        if (rootDir == undefined)
            rootDir = process.env.STATIC_PAGE_ROOT_DIR;
        await fileUtil.write(relativeFilePath, lines.join("\n"), rootDir);
    };
}

module.exports = TextFileBuilder;