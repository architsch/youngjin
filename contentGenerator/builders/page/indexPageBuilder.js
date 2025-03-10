const envUtil = require("../../utils/envUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const Header = require("../chunk/header.js");
const Footer = require("../chunk/footer.js");
const Login = require("../chunk/login.js");
const GameLinks = require("../chunk/gameLinks.js");
const FeatureLinks = require("../chunk/featureLinks.js");
require("dotenv").config();

function IndexPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async () => {
        const builder = new TextFileBuilder();

        builder.addLine(Header("index", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined));
        builder.addLine(`<h3>Login feature is coming soon... (<a href="https://github.com/architsch/youngjin">Current Progress</a>)</h3>`);
        builder.addLine(FeatureLinks());
        builder.addLine(GameLinks());
        builder.addLine(Footer());

        await builder.build("index.html");
    };
}

module.exports = IndexPageBuilder;