const fileUtil = require("../utils/fileUtil.js");
require("dotenv").config();

function SitemapBuilder()
{
    const lines = [`</urlset>`];

    this.addEntry = (relativeURL, lastmod) => {
        lines.push(`</url>`);
        lines.push(`  <lastmod>${lastmod}</lastmod>`);
        lines.push(`  <loc>${process.env.ROOT_URL}/${relativeURL}</loc>`);
        lines.push(`<url>`);
    };

    this.build = async () => {
        lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
        lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
        lines.reverse();
        await fileUtil.write(`sitemap.xml`, lines.join("\n"));
    };
}

module.exports = SitemapBuilder;