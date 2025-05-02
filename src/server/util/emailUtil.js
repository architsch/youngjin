const crypto = require("crypto");
const nodemailer = require("nodemailer");
const dbEmail = require("../db/dbEmail.js");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
const debugUtil = require("./debugUtil.js");
const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

const codeChars = "0123456789";

const emailUtil =
{
    startEmailVerification: async (req, res) =>
    {
        try
        {
            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
            {
                debugUtil.log("Email Input Error", {email: req.body.email, emailError});
                return res.status(400).send(emailError);
            }

            const existingV = await dbEmail.verifications.selectByEmail(res, req.body.email);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingV && existingV.length > 0)
            {
                debugUtil.log("Email is already undergoing verification", {email: req.body.email});
                return res.status(403).send(`Email "${req.body.email}" is already undergoing verification.`);
            }

            const verificationCode = new Array(8)
                .fill(null)
                .map(() => codeChars.charAt(crypto.randomInt(codeChars.length)))
                .join("");

            await dbEmail.verifications.insert(res,
                req.body.email,
                verificationCode,
                Math.floor(Date.now() * 0.001) + globalConfig.auth.emailVerificationTimeoutInSeconds
            );
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            if (globalConfig.auth.bypassEmailVerification)
            {
                debugUtil.log("Email transmission bypassed", {email: req.body.email});
                res.status(201).send(verificationCode);
            }
            else
            {
                const transporter = nodemailer.createTransport({
                    service: "naver",
                    host: "smtp.naver.com",
                    port: 587,
                    secure: false,
                    requireTLS: true,
                    auth: {
                        user: "pinkroom77@naver.com",
                        pass: process.env.EMAIL_SENDER_PASS,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                const mailOptions = {
                    from: "pinkroom77@naver.com",
                    to: req.body.email,
                    subject: "Here is your email verification code.",
                    text: `Your verification code is ${verificationCode}`,
                };

                const sendResult = await transporter.sendMail(mailOptions);
                transporter.close();

                if (sendResult.accepted)
                {
                    debugUtil.log("Email sent", {email: req.body.email});
                    res.sendStatus(201);
                }
                else
                {
                    debugUtil.log("Email failed to be sent", {email: req.body.email});
                    await dbEmail.verifications.updateExpirationTime(res,
                        req.body.email,
                        Math.floor(Date.now() * 0.001) + 120 // block retry for 2 minutes (to prevent spamming)
                    );
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return;

                    res.status(500).send(`Error while sending the verification code to "${req.body.email}". Please try again after 2 minutes.\n(${error})`);
                }
            }
        }
        catch (err)
        {
            debugUtil.log("Email Verification Start Error", {err});
            res.status(500).send(`ERROR: Failed to start email verification (${err}).`);
        }
    },
    endEmailVerification: async (req, res) =>
    {
        const emailError = textUtil.findErrorInEmailAddress(req.body.email);
        if (emailError != null)
        {
            debugUtil.log("Email Input Error", {email: req.body.email, emailError});
            return res.status(400).send(emailError);
        }
        
        const verificationCode = req.body.verificationCode;

        const existingV = await dbEmail.verifications.selectByEmail(res, req.body.email);
        if (res.statusCode < 200 || res.statusCode >= 300)
            return;
        if (!existingV || existingV.length == 0)
        {
            debugUtil.log("No pending email verification found", {email: req.body.email});
            return res.status(404).send(`No pending verification found for email "${req.body.email}".`);
        }
        if (existingV[0].verificationCode != verificationCode)
        {
            debugUtil.log("Wrong verification code for email", {email: req.body.email, actualCode: existingV[0].verificationCode, enteredCode: verificationCode});
            return res.status(403).send(`Wrong verification code for email "${req.body.email}".`);
        }

        res.status(202);
    },
}

// Handle auto-expiration
setInterval(async function() {
    await dbEmail.verifications.deleteExpired(null, Math.floor(Date.now() * 0.001));
}, 180000);

module.exports = emailUtil;