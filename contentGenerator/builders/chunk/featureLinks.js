const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function FeatureLinks()
{
    const lines = [];

    const addFeatureLink = (featureTitle, featureURL, imageURL) => {
        lines.push(`<a class="noTextDeco" href="${featureURL}">`);
        lines.push(`<img class="featureLink" src="${imageURL}" alt="${featureTitle}">`);
        lines.push(`</a>`);
    };

    lines.push(`<h1>Featured Articles</h1>`);
    addFeatureLink("Games in Prolog", `${envUtil.getRootURL()}/morsels/page-10.html`, `${envUtil.getRootURL()}/feat0.jpg`);
    addFeatureLink("Model of the Mind", `${envUtil.getRootURL()}/morsels/page-2.html`, `${envUtil.getRootURL()}/feat2.jpg`);
    addFeatureLink("Serious Game Design", `${envUtil.getRootURL()}/morsels/page-1.html`, `${envUtil.getRootURL()}/feat1.jpg`);
    addFeatureLink("Thought Simulator", `${envUtil.getRootURL()}/morsels/page-3.html`, `${envUtil.getRootURL()}/feat3.jpg`);
    lines.push(`<div class="s_spacer"></div>`);

    return lines.join("\n");
}

module.exports = FeatureLinks;