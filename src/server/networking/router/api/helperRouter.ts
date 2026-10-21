import express from "express";
import { Request, Response } from "express";
import User from "../../../../shared/user/types/user";
import StringUtil from "../../../../shared/math/util/stringUtil";
import MessageLinkUtil from "../../../../shared/object/util/messageLinkUtil";
import { OBJECT_MESSAGE_MAX_LENGTH, OBJECT_NAME_MAX_LENGTH } from "../../../../shared/system/sharedConstants";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import HelperAgentUtil from "../../../agent/util/helperAgentUtil";

const HelperRouter = express.Router();

// What the user said to it, at most a few chat lines' worth, links and all (see MessageLinkUtil), and the id of the NPC
// they said it to.
const MAX_LINES = 4;
const MAX_TEXT_LENGTH = MAX_LINES * MessageLinkUtil.getMaxLength(OBJECT_MESSAGE_MAX_LENGTH);
const MAX_OBJECT_ID_LENGTH = 64;

// What a helper in the user's single-player room answers what they said to it, as the browser that plays it asks (see
// HelperAgentUtil.answerAlone): "" for nothing to say.
HelperRouter.post("/reply", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);
    const { objectId, name, personality, text } = req.body ?? {};
    if (!isTextUpTo(objectId, MAX_OBJECT_ID_LENGTH) || !isTextUpTo(name, OBJECT_NAME_MAX_LENGTH)
        || !isTextUpTo(personality, OBJECT_NAME_MAX_LENGTH) || !isTextUpTo(text, MAX_TEXT_LENGTH)
        || text.trim().length == 0 || MessageLinkUtil.getVisibleLength(text) > MAX_LINES * OBJECT_MESSAGE_MAX_LENGTH)
    {
        res.status(400).send("Invalid request.");
        return;
    }
    const reply = await HelperAgentUtil.answerAlone(user.id, { objectId, name, personality }, text.trim());
    res.status(200).json({ reply });
});

function isTextUpTo(value: unknown, maxLength: number): value is string
{
    return typeof value == "string" && StringUtil.truncateByCodePoints(value, maxLength) == value;
}

export default HelperRouter;
