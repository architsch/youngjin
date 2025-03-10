const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function Register()
{
    const lines = [];

    const script = `<script>
    let verification_request_sent = false;
    let register_pending = false;

    async function verify_callback()
    {
        if (register_pending || verification_request_sent)
            return;
        verification_request_sent = true;

        const email = document.getElementById("email_input").value;
        const emailRegexPattern = /^[^\\s@]+@[^\\s@]+\.[^\\s@]+$/;
        if (!emailRegexPattern.test(email))
        {
            verification_request_sent = false;
            alert("Please enter a valid email address.");
        }

        try
        {
            const res = await fetch("${envUtil.getRootURL()}/api/vemail", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email })
            });

            if (res.ok)
            {
                alert("Verification code has been sent to your email address. Please enter it in this form.");
            }
            else
            {
                const json = await res.json();
                throw new Error(json.message);
            }
        }
        catch (err)
        {
            verification_request_sent = false;
            alert(err);
        }
    }

    async function register_callback()
    {
        if (register_pending)
            return;
        register_pending = true;

        const username = document.getElementById("username_input").value;
        const password = document.getElementById("password_input").value;
        const confirm_password = document.getElementById("confirm_password_input").value;
        const email = document.getElementById("email_input").value;
        const verificationCode = document.getElementById("email_verification_input").value;

        if (password != confirm_password)
        {
            alert("Passwords do not match. Please re-enter your passwords.");
            register_pending = false;
            return;
        }

        try
        {
            const res = await fetch("${envUtil.getRootURL()}/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password, email, verificationCode })
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
            register_pending = false;
            alert(err);
        }
    }
</script>`;

    lines.push(script);

    lines.push(`<h3>Create Account:</h3>`);
    lines.push(`<div class="s_spacer"></div>`);

    lines.push(`<div class="textInputLabel">ID</div>`);
    lines.push(`<input id="username_input" type="text" class="textInput">`);
    lines.push(`<div class="zero_spacer"></div>`);

    lines.push(`<div class="textInputLabel">Password</div>`);
    lines.push(`<input id="password_input" type="text" class="textInput">`);
    lines.push(`<div class="zero_spacer"></div>`);

    lines.push(`<div class="textInputLabel">Email</div>`);
    lines.push(`<input id="email_input" type="text" class="textInput">`);
    lines.push(`<div class="inlineButton" onclick="verify_callback()">Verify</div>`);
    lines.push(`<div class="zero_spacer"></div>`);

    lines.push(`<div class="textInputLabel">Email Verification Code</div>`);
    lines.push(`<input id="email_verification_input" type="text" class="textInput">`);
    lines.push(`<div class="s_spacer"></div>`);

    lines.push(`<div class="inlineButton" onclick="register_callback()">Register</div>`);
    lines.push(`<div class="m_spacer"></div>`);

    return lines.join("\n");
}

module.exports = Register;