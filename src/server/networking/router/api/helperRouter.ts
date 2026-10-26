import express from "express";
import { Request, Response } from "express";
import User from "../../../../shared/user/types/user";
import StringUtil from "../../../../shared/math/util/stringUtil";
import MessageLinkUtil from "../../../../shared/object/util/messageLinkUtil";
import { OBJECT_LABEL_MAX_LENGTH, OBJECT_MESSAGE_MAX_LENGTH,
    OBJECT_NAME_MAX_LENGTH } from "../../../../shared/system/sharedConstants";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import HelperAgentUtil from "../../../agent/util/helperAgentUtil";
import { MAX_SIGHTS } from "../../../../shared/object/util/helperBehaviorUtil";

const HelperRouter = express.Router();

// What the user said to it, at most a few chat lines' worth, links and all (see MessageLinkUtil), and the id of the NPC
// they said it to.
const MAX_LINES = 4;
const MAX_TEXT_LENGTH = MAX_LINES * MessageLinkUtil.getMaxLength(OBJECT_MESSAGE_MAX_LENGTH);
const MAX_OBJECT_ID_LENGTH = 64;
// Each thing a helper could go and look at, as HelperRemarkSubject describes it.
const MAX_OBJECT_TYPE_LENGTH = 16;
const MAX_PICTURE_LENGTH = 32;
const MAX_COLOR_INDEX = 93;

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

// What two helpers in the user's single-player room say as they chat, as the browser that plays them asks (see
// HelperAgentUtil.smallTalkAlone): each by its name and personality, and each line by its speaker's place among them.
HelperRouter.post("/smalltalk", UserIdentificationUtil.identifyAnyUser, (req: Request, res: Response): void => {
    const user = User.fromString((req as any).userString);
    const { helpers } = req.body ?? {};
    if (!Array.isArray(helpers) || helpers.length != 2 || !helpers.every(helper => isTextUpTo(helper?.name,
        OBJECT_NAME_MAX_LENGTH) && isTextUpTo(helper?.personality, OBJECT_NAME_MAX_LENGTH)))
    {
        res.status(400).send("Invalid request.");
        return;
    }
    const lines = HelperAgentUtil.smallTalkAlone(user.id,
        helpers.map(helper => ({ name: helper.name, personality: helper.personality })));
    res.status(200).json({ lines });
});

// Which of the things a helper in the user's single-player room could go and look at it does, and what it says of it,
// as the browser that plays it asks (see HelperAgentUtil.remarkAlone): the NPC by its id and personality, and the
// thing by its place among them, -1 for none.
HelperRouter.post("/remark", UserIdentificationUtil.identifyAnyUser, (req: Request, res: Response): void => {
    const user = User.fromString((req as any).userString);
    const { objectId, personality, things } = req.body ?? {};
    if (!isTextUpTo(objectId, MAX_OBJECT_ID_LENGTH) || !isTextUpTo(personality, OBJECT_NAME_MAX_LENGTH)
        || !Array.isArray(things) || things.length == 0 || things.length > MAX_SIGHTS || !things.every(isThing))
    {
        res.status(400).send("Invalid request.");
        return;
    }
    const remark = HelperAgentUtil.remarkAlone(user.id, { objectId, personality }, things.map(thing => ({
        objectType: thing.objectType, picture: thing.picture, color: thing.color, text: thing.text })));
    res.status(200).json(remark ?? { index: -1, text: "" });
});

function isTextUpTo(value: unknown, maxLength: number): value is string
{
    return typeof value == "string" && StringUtil.truncateByCodePoints(value, maxLength) == value;
}

// A thing as HelperRemarkSubject describes it: its type, and maybe its picture, its light's color and its words.
function isThing(thing: any): boolean
{
    return isTextUpTo(thing?.objectType, MAX_OBJECT_TYPE_LENGTH)
        && (thing.picture == undefined || isTextUpTo(thing.picture, MAX_PICTURE_LENGTH))
        && (thing.color == undefined || (Number.isInteger(thing.color) && thing.color >= 0
            && thing.color <= MAX_COLOR_INDEX))
        && (thing.text == undefined || isTextUpTo(thing.text, OBJECT_LABEL_MAX_LENGTH));
}

export default HelperRouter;
