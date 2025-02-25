const fileUtil = require("../../utils/fileUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
require("dotenv").config();

function AboutPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async () => {
        const cb = new HTMLChunkBuilder();

        cb.addHeader("about", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined);
        
        cb.addLine(`<h1>About Myself</h1>`);
        cb.addLine(`<img class="profileImage" src="${process.env.ROOT_URL}/profile.jpg" alt="Youngjin Kang">`);
        cb.addLine(`<div class="m_spacer"></div>`);
        cb.addLine(`<h3>About Myself</h3>`);
        cb.addLine(`<p>My name is Youngjin, and I am a software engineer who develops computer games, simulations, and other types of interactive media. I studied electrical and electronics engineering at the University of Washington, and worked as a developer in game companies such as Signal Studios (Bothell, WA), Valkyrie Entertainment (Seattle, WA), Galactic Entertainment (United Kingdom), and Branch Technologies (Seattle, WA).</p>`);
        cb.addLine(`<p>ThingsPool is an experimental development studio which I have founded for the purpose of showcasing software toys and tools that are easily accessible and furnished with unique personalities.</p>`);
        cb.addLine(`<p>Besides apps, however, there are also a wide variety of arts and writings in this website which discuss multidisciplinary topics such as philosophy, mathematics, engineering, and literature.</p>`);
        cb.addLine(`<div class="m_spacer"></div>`);
        cb.addLine(`<h3><a href="${process.env.ROOT_URL}/youngjin_resume.pdf">Resume</a></h3>`);
        cb.addLine(`<h3><a href="https://www.linkedin.com/in/youngjin-kang-55321882">LinkedIn Profile</a></h3>`);
        cb.addLine(`<h3><a href="https://github.com/architsch">GitHub Profile</a></h3>`);
        cb.addLine(`<h3><a href="https://www.pacogames.com/developers/thingspool">PacoGames Profile</a></h3>`);

        cb.addFooter();

        sitemapBuilder.addEntry("about.html", "2025-02-24");

        await cb.build("about.html");
    };
}

module.exports = AboutPageBuilder;