const envUtil = require("../../utils/envUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const Header = require("../chunk/header.js");
const Footer = require("../chunk/footer.js");
require("dotenv").config();

function AboutPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async () => {
        const builder = new TextFileBuilder();

        builder.addLine(Header("about", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined));
        
        builder.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}">Back</a>`);

        builder.addLine(`<h1>About Myself</h1>`);
        builder.addLine(`<img class="profileImage" src="${envUtil.getRootURL()}/profile.jpg" alt="Youngjin Kang">`);
        builder.addLine(`<div class="m_spacer"></div>`);
        builder.addLine(`<h3>About Myself</h3>`);
        builder.addLine(`<p>My name is Youngjin, and I am a software engineer who develops computer games, simulations, and other types of interactive media. I studied electrical and electronics engineering at the University of Washington, and worked as a developer in game companies such as Signal Studios (Bothell, WA), Valkyrie Entertainment (Seattle, WA), and Galactic Entertainment (United Kingdom).</p>`);
        builder.addLine(`<p>ThingsPool is an experimental development studio which I have founded for the purpose of showcasing software toys and tools that are easily accessible and furnished with unique personalities.</p>`);
        builder.addLine(`<p>Besides apps, however, there are also a wide variety of arts and writings in this website which discuss multidisciplinary topics such as philosophy, mathematics, engineering, and literature.</p>`);
        builder.addLine(`<div class="m_spacer"></div>`);
        builder.addLine(`<h3><a href="https://www.linkedin.com/in/youngjin-kang-55321882">LinkedIn Profile</a></h3>`);
        builder.addLine(`<h3><a href="https://github.com/architsch">GitHub Profile</a></h3>`);
        builder.addLine(`<h3><a href="https://www.pacogames.com/developers/thingspool">PacoGames Profile</a></h3>`);

        builder.addLine(Footer());

        sitemapBuilder.addEntry("about.html", "2025-02-28");

        await builder.build("about.html");
    };
}

module.exports = AboutPageBuilder;