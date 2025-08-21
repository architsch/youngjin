import crypto from "crypto";
import nodemailer from "nodemailer";
import EmailDB from "../db/emailDB";
import TextUtil from "../../shared/util/textUtil";
import DebugUtil from "./debugUtil";
import GlobalConfig from "../../shared/config/globalConfig";
import dotenv from "dotenv";
import { Request, Response } from "express";
import UIConfig from "../../shared/config/uiConfig";
dotenv.config();

const codeChars = "0123456789";

const EmailUtil =
{
    startEmailVerification: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            await EmailDB.verifications.deleteExpired(Math.floor(Date.now() * 0.001), res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            const emailError = TextUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
            {
                DebugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high", "pink");
                res.status(400).send(UIConfig.displayText.message[emailError]);
                return;
            }

            const existingV = await EmailDB.verifications.selectByEmail(req.body.email, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingV && existingV.length > 0)
            {
                DebugUtil.log("Email is already undergoing verification", {email: req.body.email}, "high", "pink");
                res.status(403).send(`Email "${req.body.email}" is already undergoing verification.`);
                return;
            }

            const verificationCode = new Array(8)
                .fill(null)
                .map(() => codeChars.charAt(crypto.randomInt(codeChars.length)))
                .join("");

            await EmailDB.verifications.insert(
                req.body.email,
                verificationCode,
                Math.floor(Date.now() * 0.001) + GlobalConfig.auth.emailVerificationTimeoutInSeconds,
                res
            );
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            if (GlobalConfig.auth.bypassEmailVerification)
            {
                DebugUtil.log("Email transmission bypassed", {email: req.body.email}, "low");
                res.status(201).send(verificationCode);
            }
            else
            {
                const transporter = nodemailer.createTransport({
                    service: "naver",
                    host: "smtp.naver.com",
                    auth: {
                        user: "pinkroom77@naver.com",
                        pass: process.env.EMAIL_SENDER_PASS,
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
                    DebugUtil.log("Email sent", {email: req.body.email}, "low");
                    res.sendStatus(201);
                }
                else
                {
                    DebugUtil.log("Email failed to be sent", {email: req.body.email}, "high", "pink");
                    await EmailDB.verifications.updateExpirationTime(
                        req.body.email,
                        Math.floor(Date.now() * 0.001) + 120, // block retry for 2 minutes (to prevent spamming)
                        res
                    );
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return;

                    res.status(500).send(`Error while sending the verification code to "${req.body.email}". Please try again after 2 minutes.`);
                }
            }
        }
        catch (err)
        {
            DebugUtil.log("Email Verification Start Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to start email verification (${err}).`);
        }
    },
    endEmailVerification: async (req: Request, res: Response): Promise<void> =>
    {
        const emailError = TextUtil.findErrorInEmailAddress(req.body.email);
        if (emailError != null)
        {
            DebugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high", "pink");
            res.status(400).send(UIConfig.displayText.message[emailError]);
            return;
        }
        
        const verificationCode = req.body.verificationCode as string;

        const existingV = await EmailDB.verifications.selectByEmail(req.body.email, res);
        if (res.statusCode < 200 || res.statusCode >= 300)
            return;
        if (!existingV || existingV.length == 0)
        {
            DebugUtil.log("No pending email verification found", {email: req.body.email}, "high", "pink");
            res.status(404).send(`No pending verification found for email "${req.body.email}".`);
            return;
        }
        if (existingV[0].verificationCode != verificationCode)
        {
            DebugUtil.log(`Verification Code Mismatch (code entered = '${verificationCode}')`,
                {email: req.body.email, actualCode: existingV[0].verificationCode, enteredCode: verificationCode}, "high", "pink");
            res.status(403).send(`Wrong verification code for email "${req.body.email}".`);
            return;
        }

        res.status(202);
    },
}

export default EmailUtil;