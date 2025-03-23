const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

const bypassEmailVerification = globalConfig.userRegistration.bypassEmailVerification;

const pendingEmailVerifications = {};
const codeChars = "0123456789";
const removePending = [];

const emailUtil =
{
    getAllPendingVerifications: () =>
    {
        return pendingEmailVerifications;
    },
    startEmailVerification: async (req, res) =>
    {
        if (bypassEmailVerification)
        {
            await new Promise(resolve => setTimeout(resolve, 1500));
            return res.status(201);
        }
        
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

            const oauth2Client = new OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                "https://developers.google.com/oauthplayground"
            );
            oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
            const accessToken = await new Promise((resolve, reject) => {
                oauth2Client.getAccessToken((err, token) => {
                    if (err) {
                        reject("Failed to create the access token.");
                    }
                    resolve(token);
                });
            });

            const transporter = nodemailer.createTransport({
                service: "gmail",
                host: "smtp.gmail.com",
                port: 587,
                secure: true,
                auth: {
                    type: "OAuth2",
                    user: process.env.GMAIL_USER,
                    clientId: process.env.GMAIL_CLIENT_ID,
                    clientSecret: process.env.GMAIL_CLIENT_SECRET,
                    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                    accessToken: accessToken,
                },
            });

            const mailOptions = {
                to: email,
                subject: "Here is your email verification code.",
                text: `Your verification code is ${verificationCode}`,
            };

            const pendingVerification = {
                code: verificationCode,
                expirationTime: Date.now() + 600000, // expires after 10 minutes
            };
            pendingEmailVerifications[email] = pendingVerification;

            const sendResult = await transporter.sendMail(mailOptions);
            if (sendResult.accepted)
            {
                console.log(`Email sent (${email})`);
                res.sendStatus(201);
            }
            else
            {
                pendingVerification.expirationTime = Date.now() + 120000; // block retry for 2 minutes (to prevent spamming)
                res.status(500).send(`Error while sending the verification code to "${email}". Please try again after 2 minutes.\n(${error})`);
            }
        }
        catch (err)
        {
            res.status(500).send(`ERROR: Failed to start email verification (${err}).`);
        }
    },
    endEmailVerification: (req, res) =>
    {
        if (bypassEmailVerification)
        {
            return res.status(202);
        }
        
        const emailError = textUtil.findErrorInEmailAddress(req.body.email);
        if (emailError != null)
            return res.status(400).send(emailError);
        
        const email = req.body.email;
        const verificationCode = req.body.verificationCode;

        const pendingVerification = pendingEmailVerifications[email];
        if (pendingVerification == undefined || pendingVerification.code != verificationCode)
            return res.status(403).send(`Verification of email "${email}" failed. Please try again.`);

        res.status(202);
    },
}

// Handle auto-expiration
setInterval(function() {
    const currTime = Date.now();
    for (const [email, verification] of Object.entries(pendingEmailVerifications))
    {
        if (currTime > verification.expirationTime)
            removePending.push(email);
    }
    while (removePending.length > 0)
    {
        const emailToRemove = removePending.pop();
        delete pendingEmailVerifications[emailToRemove];
        console.log(`Pending email verification removed (${emailToRemove}).\nRemaining verifications = ${Object.keys(pendingEmailVerifications).length}`);
    }
}, 5000);

module.exports = emailUtil;