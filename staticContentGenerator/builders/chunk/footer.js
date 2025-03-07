const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function Footer()
{
    const lines = [];

    lines.push(`<footer>`);
    lines.push(`&copy 2019-2025 ThingsPool. All rights reserved.`);
    lines.push(`<div class="l_spacer"></div>`);
    lines.push(`</footer>`);
    lines.push(`</div>`);
    lines.push(`</body>`);
    lines.push(`</html>`);

    return lines.join("\n");
}

module.exports = Footer;