import { NpcPersonality } from "../../../shared/object/types/npcPersonality";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";
import { NPC_MESSAGE_MAX_LENGTH } from "../../../shared/system/sharedConstants";
import { HELPER_SMALL_TALK } from "../data/helperSmallTalk";

// How often the one who opens a chat nods to the answer when it has no second thought of its own, and how often the
// other nods to a second thought before it says goodbye.
const NOD_CHANCE = 0.7;
const NOD_BEFORE_GOODBYE_CHANCE = 0.5;

// What two helpers say when they chat (see HelperBehaviorUtil.startSmallTalk), from their voices (see
// helperSmallTalk.ts), so that the manner of a chat is theirs together: one of them, picked at random, says hello and
// brings up something it likes; the other answers on that in its own voice; the first adds a second thought on it, or
// mostly nods; and the other says goodbye. One with no name is called a friend.
const HelperSmallTalkUtil =
{
    // Each line by its speaker's place among the two; none unless both are played.
    compose: (helpers: {name: string, personality: NpcPersonality}[]): {by: number, text: string}[] =>
    {
        const voices = helpers.map(helper => HELPER_SMALL_TALK[helper.personality as Exclude<NpcPersonality, "idle">]);
        if (helpers.length != 2 || voices.some(voice => voice == undefined))
            return [];
        const first = (Math.random() < 0.5) ? 0 : 1;
        const second = 1 - first;
        // A line's links are kept whole, as a bubble shows them (see MessageLinkUtil).
        const line = (by: number, text: string) => ({by, text: MessageLinkUtil.shorten(
            text.replace(/\{name\}/g, () => helpers[1 - by].name || "friend"), NPC_MESSAGE_MAX_LENGTH)});

        const opener = pick(voices[first].openers);
        const lines = [
            line(first, `${pick(voices[first].hellos)} ${opener.text}`),
            line(second, pick(voices[second].answers[opener.topic])),
        ];
        const thought = opener.then ?? ((Math.random() < NOD_CHANCE) ? pick(voices[first].nods) : undefined);
        if (thought != undefined)
            lines.push(line(first, thought));
        const goodbye = pick(voices[second].goodbyes);
        lines.push(line(second, (opener.then != undefined && Math.random() < NOD_BEFORE_GOODBYE_CHANCE)
            ? `${pick(voices[second].nods)} ${goodbye}` : goodbye));
        return lines;
    },
}

function pick<T>(options: T[]): T
{
    return options[Math.floor(Math.random() * options.length)];
}

export default HelperSmallTalkUtil;
