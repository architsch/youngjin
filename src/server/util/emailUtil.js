const crypto = require("crypto");
const nodemailer = require("nodemailer");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
require("dotenv").config();

const pendingEmailVerifications = {};
const codeChars = "0123456789";
const removePending = [];

const emailUtil =
{
    startEmailVerification: (req, res) =>
    {
        try
        {
            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
                return res.status(400).send(emailError);

            const email = req.body.email;

            if (pendingEmailVerifications[email] != undefined)
                return res.status(403).send(`Email "${email}" is already undergoing verification.`);

            const verificationCode = new Array(8)
                .fill(null)
                .map(() => codeChars.charAt(crypto.randomInt(codeChars.length)))
                .join("");

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: "thingspool@gmail.com",
                    pass: process.env.EMAIL_SENDER_PASS,
                }
            });

            const mailOptions = {
                from: "thingspool@gmail.com",
                to: email,
                subject: "Here is your email verification code.",
                text: `Your verification code is ${verificationCode}`,
            };

            transporter.sendMail(mailOptions, function(error, info) {
                if (error)
                {
                    res.status(500).send(`Error while sending the verification code to "${email}" (Error: ${error}).`);
                }
                else
                {
                    console.log("Email sent: " + info.response);

                    const pendingVerification = {
                        code: verificationCode,
                        startTime: Date.now(),
                    };
                    pendingEmailVerifications[email] = pendingVerification;
                    res.sendStatus(201);
                }
            });
        }
        catch (err)
        {
            res.status(500).send(`ERROR: Failed to start email verification (${err}).`);
        }
    },
    endEmailVerification: (req, res) =>
    {
        const emailError = textUtil.findErrorInEmailAddress(req.body.email);
        if (emailError != null)
            return res.status(400).send(emailError);
        
        const email = req.body.email;
        const verificationCode = req.body.verificationCode;

        const pendingVerification = pendingEmailVerifications[email];
        if (pendingVerification == undefined || pendingVerification.code != verificationCode)
            return res.status(403).send(`Verification of email "${email}" failed. Please try again.`);

        delete pendingEmailVerifications[email];
    },
}

// Handle auto-expiration
setInterval(function() {
    const currTime = Date.now();
    for (const [email, verification] of Object.entries(pendingEmailVerifications))
    {
        if (currTime - verification.startTime > 600000) // expires after 10 minutes
            removePending.push(email);
    }
    while (removePending.length > 0)
        delete pendingEmailVerifications[removePending.pop()];
}, 2000);

module.exports = emailUtil;