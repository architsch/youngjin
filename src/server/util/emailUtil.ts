import crypto from "crypto";
import nodemailer from "nodemailer";
import dbEmail from "../db/dbEmail";
import textUtil from "../../shared/util/textUtil";
import debugUtil from "./debugUtil";
import globalConfig from "../config/globalConfig";
import dotenv from "dotenv";
import { Request, Response } from "express";
dotenv.config();

const codeChars = "0123456789";

const emailUtil =
{
    startEmailVerification: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            await dbEmail.verifications.deleteExpired(Math.floor(Date.now() * 0.001), res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
            {
                debugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high", "pink");
                res.status(400).send(emailError);
                return;
            }

            const existingV = await dbEmail.verifications.selectByEmail(req.body.email, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingV && existingV.length > 0)
            {
                debugUtil.log("Email is already undergoing verification", {email: req.body.email}, "high", "pink");
                res.status(403).send(`Email "${req.body.email}" is already undergoing verification.`);
                return;
            }

            const verificationCode = new Array(8)
                .fill(null)
                .map(() => codeChars.charAt(crypto.randomInt(codeChars.length)))
                .join("");

            await dbEmail.verifications.insert(
                req.body.email,
                verificationCode,
                Math.floor(Date.now() * 0.001) + globalConfig.auth.emailVerificationTimeoutInSeconds,
                res
            );
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            if (globalConfig.auth.bypassEmailVerification)
            {
                debugUtil.log("Email transmission bypassed", {email: req.body.email}, "low");
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
                    debugUtil.log("Email sent", {email: req.body.email}, "low");
                    res.sendStatus(201);
                }
                else
                {
                    debugUtil.log("Email failed to be sent", {email: req.body.email}, "high", "pink");
                    await dbEmail.verifications.updateExpirationTime(
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
            debugUtil.log("Email Verification Start Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to start email verification (${err}).`);
        }
    },
    endEmailVerification: async (req: Request, res: Response): Promise<void> =>
    {
        const emailError = textUtil.findErrorInEmailAddress(req.body.email);
        if (emailError != null)
        {
            debugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high", "pink");
            res.status(400).send(emailError);
            return;
        }
        
        const verificationCode = req.body.verificationCode as string;

        const existingV = await dbEmail.verifications.selectByEmail(req.body.email, res);
        if (res.statusCode < 200 || res.statusCode >= 300)
            return;
        if (!existingV || existingV.length == 0)
        {
            debugUtil.log("No pending email verification found", {email: req.body.email}, "high", "pink");
            res.status(404).send(`No pending verification found for email "${req.body.email}".`);
            return;
        }
        if (existingV[0].verificationCode != verificationCode)
        {
            debugUtil.log(`Verification Code Mismatch (code entered = '${verificationCode}')`,
                {email: req.body.email, actualCode: existingV[0].verificationCode, enteredCode: verificationCode}, "high", "pink");
            res.status(403).send(`Wrong verification code for email "${req.body.email}".`);
            return;
        }

        res.status(202);
    },
}

export default emailUtil;