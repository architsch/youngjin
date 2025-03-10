const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function Login()
{
    const lines = [];

    const script = `<script>
    let login_pending = false;

    async function login_callback()
    {
        if (login_pending)
            return;
        login_pending = true;

        const username = document.getElementById("username_input").value;
        const password = document.getElementById("password_input").value;

        try
        {
            const res = await fetch("${envUtil.getRootURL()}/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password })
            });

            if (res.ok)
            {
                fetch("${envUtil.getRootURL()}");
            }
            else
            {
                const json = await res.json();
                throw new Error(json);
            }
        }
        catch (err)
        {
            login_pending = false;
            alert(err);
        }
    }
    function register_callback()
    {
        if (login_pending)
            return;
        fetch("${envUtil.getRootURL()}/page/register");
    }
</script>`;

    lines.push(script);

    lines.push(`<h3>Please log in.</h3>`);
    lines.push(`<div class="s_spacer"></div>`);

    lines.push(`<div class="textInputLabel">ID</div>`);
    lines.push(`<input id="username_input" type="text" class="textInput">`);
    lines.push(`<div class="zero_spacer"></div>`);

    lines.push(`<div class="textInputLabel">Password</div>`);
    lines.push(`<input id="password_input" type="text" class="textInput">`);
    lines.push(`<div class="s_spacer"></div>`);

    lines.push(`<div class="inlineButton" onclick="login_callback()">Log In</div>`);
    lines.push(`<div class="inlineButton" onclick="register_callback()">Register</div>`);
    lines.push(`<div class="m_spacer"></div>`);

    return lines.join("\n");
}

module.exports = Login;