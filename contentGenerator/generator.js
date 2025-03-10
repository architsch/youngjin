const fileUtil = require("./utils/fileUtil.js");
const TextFileBuilder = require("./builders/textFileBuilder.js");
const Header = require("./builders/chunk/header.js");
const Footer = require("./builders/chunk/footer.js");
const GameLinks = require("./builders/chunk/gameLinks.js");
const FeatureLinks = require("./builders/chunk/featureLinks.js");
const Login = require("./builders/chunk/login.js");
const Dashboard = require("./builders/chunk/dashboard.js");
const Register = require("./builders/chunk/register.js");
require("dotenv").config();

async function run()
{
    // Generate chunks

    let builder = new TextFileBuilder();
    builder.addLine(Header("<%= pageName %>", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", "", undefined, true));
    await builder.build("chunk/header.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(Footer());
    await builder.build("chunk/footer.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(Login());
    await builder.build("chunk/login.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(Dashboard());
    await builder.build("chunk/dashboard.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(Register());
    await builder.build("chunk/register.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(GameLinks());
    await builder.build("chunk/gameLinks.ejs", process.env.VIEWS_ROOT_DIR);

    builder = new TextFileBuilder();
    builder.addLine(FeatureLinks());
    await builder.build("chunk/featureLinks.ejs", process.env.VIEWS_ROOT_DIR);

    // Generate pages

    const sitemapBuilder = new (require("./builders/sitemapBuilder.js"))();
    const atomFeedBuilder = new (require("./builders/atomFeedBuilder.js"))();

    await new (require("./builders/page/indexPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/aboutPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/arcadePageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/libraryPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();

    await sitemapBuilder.build();
    await atomFeedBuilder.build();

    // Generate CSS

    await fileUtil.write("style.css", require('./styles/styleDictionary.js'));
}

run();