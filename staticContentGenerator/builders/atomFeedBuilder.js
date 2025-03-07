const fileUtil = require("../utils/fileUtil.js");
const envUtil = require("../utils/envUtil.js");
require("dotenv").config();

function AtomFeedBuilder()
{
    const lines = [`</feed>`];
    let globalLatestUpdate = new Date(process.env.GLOBAL_LAST_MOD);

    this.addEntry = (url, title, lastmod, description) => {
        const date = new Date(lastmod);
        if (date > globalLatestUpdate)
            globalLatestUpdate = date;

        lines.push(`</entry>`);
        lines.push(`  <summary>${description}</summary>`);
        lines.push(`  <updated>${date.toISOString()}</updated>`);
        lines.push(`  <id>${url}</id>`); // not ideal to use the url as unique never changing id but there is no other id for each article.
        lines.push(`  <link href="${url}"/>`);
        lines.push(`  <title>${title}</title>`);
        lines.push(`<entry>`);
    };

    this.build = async () => {
        lines.push(`<id>urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c</id>`); // uuid randomly generated
        lines.push(`</author>`);
        lines.push(`  <name>Youngjin Kang</name>`);
        lines.push(`<author>`);
        lines.push(`<updated>${globalLatestUpdate.toISOString()}</updated>`);
        lines.push(`<link href="${envUtil.getRootURL()}"/>`);
        lines.push(`<link rel="self" type="application/atom+xml" href="${envUtil.getRootURL()}/feed.atom"/>`);
        lines.push(`<title>ThingsPool</title>`);
        lines.push(`<feed xmlns="http://www.w3.org/2005/Atom">`);
        lines.push(`<?xml version="1.0" encoding="utf-8"?>`);
        lines.reverse();
        await fileUtil.write(`feed.atom`, lines.join("\n"));
    };
}

module.exports = AtomFeedBuilder;