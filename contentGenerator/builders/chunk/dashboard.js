const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function Dashboard()
{
    const lines = [];

    const script = `<script>
    let logout_pending = false;

    async function logout_callback()
    {
        if (logout_pending)
            return;
        logout_pending = true;

        try
        {
            const res = await fetch("${envUtil.getRootURL()}/api/logout", {
                method: "DELETE"
            });

            if (res.ok)
            {
                fetch("${envUtil.getRootURL()}");
            }
            else
            {
                const json = await res.json();
                throw new Error(json.message);
            }
        }
        catch (err)
        {
            logout_pending = false;
            alert(err);
        }
    }
</script>`;

    lines.push(script);
    lines.push(`<h3>Welcome, <%= user.username %>!</h3>`);
    lines.push(`<div class="inlineButton" onclick="logout_callback()">Log Out</div>`);
    lines.push(`<div class="s_spacer"></div>`);
    lines.push(`<p>Your Data: <%= JSON.stringify(user, null, 4) %></p>`);
    lines.push(`<div class="m_spacer"></div>`);

    return lines.join("\n");
}

module.exports = Dashboard;