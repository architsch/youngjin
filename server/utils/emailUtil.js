const crypto = require("crypto");
const nodemailer = require("nodemailer");
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
            const email = req.body.email;

            if (pendingEmailVerifications[email] != undefined)
                return res.status(403).json({ message: `Email "${email}" is already undergoing verification.` });

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
                text: `Your verification code is ${verificationCode}. Please enter this number in your registration form to verify that this email address is yours.`,
            };

            transporter.sendMail(mailOptions, function(error, info) {
                if (error)
                {
                    return res.status(500).json({ message: `Error while sending the verification code to "${email}" (Error: ${error}).` });
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
            res.status(500).json({ message: `ERROR: Failed to start email verification (${err}).` });
        }
    },
    endEmailVerification: (req, res) =>
    {
        const email = req.body.email;
        const verificationCode = req.body.verificationCode;

        const pendingVerification = pendingEmailVerifications[email];
        if (pendingVerification == undefined || pendingVerification.code != verificationCode)
            return res.status(403).json({ message: `Verification of email "${email}" failed. Please try again.` });

        delete pendingEmailVerifications[email];
        res.sendStatus(201);
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