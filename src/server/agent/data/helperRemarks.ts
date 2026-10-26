import { NpcPersonality } from "../../../shared/object/types/npcPersonality";
import HelperRemarkVoice from "../types/helperRemarkVoice";

// What helpers say of the things they go and look at (see HelperRemarkUtil), in each played personality's voice (see
// helperPersonalities.ts): fixed words, so a remark costs no model, with gaps for the thing, for what the helper likes or
// dislikes in it (see helperTastes.ts), and for words picked at random, so that the same thing is seldom spoken of in
// the same words twice. Like the small talk (see helperSmallTalk.ts), each line is plain and clear on its own: an
// opinion, or a fact true of the game as the guide has it (see helperGuide.ts) or of the world, never a pun, nor a
// metaphor a reader must decode. What fills {reason} or {other} is a thing liked ("Korean food", "the color blue"), so a
// line says it only where any of those fits ("I love {reason}", "Nothing beats {reason}"), never as the one doing
// something.

// Words for the gaps a line leaves, picked at random; a gap named with a capital ({Gush}) starts a sentence.
export const REMARK_WORDS: {[gap: string]: string[]} = {
    lovely: ["lovely", "wonderful", "beautiful", "fantastic", "splendid"],
    nice: ["nice", "pleasant", "charming", "well chosen"],
    really: ["really", "truly"],
    // Of something it loves.
    gush: ["I could look at [it|them] all day", "[it|they] really [catches|catch] my eye", "[it|they] [makes|make] my day",
        "[it|they] never [gets|get] old", "[it's|they're] just my kind of thing"],
    // Of something it likes.
    approve: ["[it|they] [suits|suit] this room", "[it|they] [fits|fit] right in here", "[it|they] [brightens|brighten] "
        + "the place up", "[it's|they're] a nice touch"],
    // Of something it neither likes nor dislikes.
    shrug: ["[it's|they're] fine, I suppose", "[it|they] [doesn't|don't] do much for me", "I can take [it|them] or "
        + "leave [it|them]", "[it's|they're] all right, I guess"],
    // Of something it dislikes, kindly.
    demur: ["[it's|they're] not my cup of tea", "[it's|they're] not really for me", "I'll leave [it|them] to others"],
};

// Words a thing's name keeps as they are in the middle of a sentence: names of peoples, places and brands.
export const PROPER_WORDS: string[] = ["Japanese", "Korean", "Mexican", "Italian", "Chinese", "Macintosh"];

export const HELPER_REMARKS: {[personality in Exclude<NpcPersonality, "idle">]: HelperRemarkVoice} = {
    guide: {
        love: ["{Thing}! I love {reason}, and {gush}.", "Oh, look at {thing}. I {really} love {reason}.",
            "I could stop by {thing} every day. Nothing beats {reason}.",
            "{Thing}! I'd show [it|them] to every newcomer. I love {reason}."],
        like: ["{Thing}. I like {reason}, and {approve}.", "{Thing} [is|are] {nice}. I've always liked {reason}.",
            "I like {thing}. {Approve}."],
        meh: ["{Thing}. Honestly, {shrug}.", "Hmm, {thing}. {Shrug}, but visitors seem to like [it|them].",
            "I don't think much about {reason}, but {thing} [is|are] {nice}.",
            "{Thing}. Not my favorite, but {approve}."],
        dislike: ["{Thing}... I've never been fond of {reason}. Someone else will love [it|them].",
            "Hmm, {thing}. {Demur}, but I'm sure visitors will like [it|them].",
            "To be honest, I don't care for {reason}. But {thing} [looks|look] well made."],
        mixed: ["{Thing}. I love {reason}, but {other}? Not so much.",
            "{Thing}: I like {reason}, but I've never cared for {other}."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. I'd point this one out to every visitor.",
                "Have you seen '{title}' by {painter}? It's one of my favorite pictures here."]},
            photo: {liked: ["Youngjin, who made ThingsPool, took this photo: '{title}'. I love showing it to visitors."]},
            door: {liked: ["{Thing}! Every room has a door to a hub, a public room everyone shares. I wonder where this "
                + "one leads.", "{Thing}. You walk up to a door and click it to go through. Easy!"]},
            sign: {liked: ["{Thing}. Good signs help newcomers find their way."]},
            mirror: {liked: ["{Thing}! I can see myself in it. Looking good, if I say so myself."]},
            lamp: {liked: ["{Thing} gives such a {nice} light. It makes the room feel friendly."]},
        },
    },
    builder: {
        love: ["Look at {thing}! I love {reason}. {Gush}!",
            "{Thing}! I love {reason} so much, I'd build a whole room around [it|them].",
            "Great pick, whoever placed {thing}. I love {reason}!", "{Thing}! Now that's what I like to see. I love {reason}."],
        like: ["{Thing}. Nice! I like {reason}, and {approve}.", "{Thing} [is|are] a solid choice. I've always liked "
            + "{reason}.", "I like {thing}. Good work, whoever placed [it|them]."],
        meh: ["{Thing}. {Shrug}. I'd rather be building.", "{Thing}? {Shrug}. Now, a good staircase would get me excited.",
            "{Thing}. Fine by me. Now, what to build next?", "Hmm, {thing}. {Shrug}. Where are my blocks?"],
        dislike: ["{Thing}... I've never cared for {reason}. I'd put a staircase here instead.",
            "{Thing}? {Demur}. I'm more of a blocks-and-stairs person.",
            "{Thing}. I've never been big on {reason}. But hey, it's not my room."],
        mixed: ["{Thing}. I'm all for {reason}, but {other}? I'll pass.",
            "{Thing}. I love {reason}. I could do without {other}, though."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. A picture this good deserves a big, solid wall."]},
            lamp: {liked: ["{Thing}! A lamp at the top of the stairs is my favorite trick. You can change its color, too."]},
            fan: {liked: ["{Thing}! Put a fan on the floor and it bounces people up. Best bounce pad there is."]},
            door: {liked: ["{Thing}. A frame of blocks around a door makes it look great."]},
            sign: {liked: ["{Thing}. Every good building needs clear signs."]},
            mirror: {liked: ["{Thing}! Only ThingsPool's admins can hang a mirror. I'd put one in every room."]},
        },
    },
    explorer: {
        love: ["{Thing}! I love {reason}. I'd travel a long way to see [it|them].", "Found it: {thing}! I love {reason}.",
            "{Thing}! Coming across {reason} always makes my day.",
            "Every room has its treasure, and here it's {thing}. I love {reason}!"],
        like: ["{Thing}. I like {reason}. {Approve}.", "Ooh, {thing}. I always notice {reason} when I explore a room.",
            "{Thing}! I like {reason}. That's worth remembering about this room."],
        meh: ["{Thing}. {Shrug}. I wonder what's behind the next door, though.",
            "Hmm, {thing}. Not what I came looking for, but {approve}.",
            "{Thing}. Noted. Now, what else is in this room?", "{Thing}. {Shrug}. I'd rather find a hidden corner."],
        dislike: ["{Thing}... I've never liked {reason} much. On to the next room!",
            "{Thing}? {Demur}. There's plenty more to explore."],
        mixed: ["{Thing}. I love {reason}, but I could do without {other}.",
            "{Thing}. {Reason}, yes! {Other}, no thanks."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. I'd love to step into this picture and look around."]},
            photo: {liked: ["Youngjin, who made ThingsPool, took this photo: '{title}'. I wonder where he was standing."]},
            door: {liked: ["{Thing}! I wonder where it leads. Every room has a door to a hub, but some lead much "
                + "farther.", "A door! You click one to go through it. I could open doors all day."]},
            mirror: {liked: ["{Thing}! It shows the whole room behind me. Handy for an explorer."]},
            sign: {liked: ["{Thing}. Signs are how I find my way around a new room."]},
        },
    },
    storyteller: {
        love: ["{Thing}! I love {reason}. There's always a story behind [it|them].",
            "Ah, {thing}. I love {reason}, and {gush}.",
            "{Thing}! If I wrote a story about this room, [it|they] would be in the first chapter.",
            "Oh, {thing}. Nothing beats {reason}, if you ask me."],
        like: ["{Thing}. I like {reason}. [It|They] would fit nicely in a story.",
            "{Thing} [is|are] {nice}. I've always liked {reason}.", "I like {thing}. I wonder who put [it|them] here, "
            + "and why."],
        meh: ["{Thing}. {Shrug}. Not much of a story in [it|them], I'm afraid.",
            "Hmm, {thing}. {Shrug}, but every room needs its quiet corners.",
            "{Thing}. Every story needs a few plain things in it too.",
            "{Thing}. {Shrug}. Give me an old book any day."],
        dislike: ["{Thing}... I've never been fond of {reason}. Still, someone surely loves [it|them].",
            "{Thing}? {Demur}. I'd rather have a good book."],
        mixed: ["{Thing}. I love {reason}, but {other}? That's a different story.",
            "{Thing}. I adore {reason}, though I've never cared for {other}."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. They say every picture tells a story. I wonder what this one's story "
                + "is."]},
            photo: {liked: ["'{title}' is a photo by Youngjin, who made ThingsPool. I'd love to hear the story behind "
                + "it."]},
            door: {liked: ["{Thing}. In old stories, a door often leads to another world. Here, it really leads to "
                + "another room!"]},
            mirror: {liked: ["{Thing}! In 'Snow White', a mirror answers the queen. This one only shows the room."]},
            lamp: {liked: ["{Thing}. Long ago, people told stories by lamplight. This one would do nicely."]},
        },
    },
    jester: {
        love: ["{Thing}! I love {reason} more than I love naps, and I really love naps.",
            "Look at {thing}! I love {reason}. Ten out of ten!",
            "{Thing}! If I could, I'd take [it|them] home. I love {reason}!", "Stop everything: {thing}! I love {reason}."],
        like: ["{Thing}. Not bad at all! I like {reason}.",
            "I like {thing}. I'd give [it|them] eight out of ten, and I'm a tough judge.",
            "{Thing}! I like {reason}, and {approve}."],
        meh: ["{Thing}. I'd give [it|them] five out of ten. Maybe five and a half.",
            "{Thing}. {Shrug}. Now, a room full of rubber ducks, that would be something.",
            "{Thing}. Hmm. I've seen more exciting things. I've also seen less exciting things.",
            "{Thing}. [It's no rubber duck|They're no rubber ducks], but {approve}."],
        dislike: ["{Thing}... Me and {reason}? We don't get along.", "{Thing}? {Demur}. More for everyone else!",
            "{Thing}. Sorry, {reason} and I are not friends."],
        mixed: ["{Thing}. Good news: {reason}! Bad news: {other}.", "{Thing}. I love {reason}, but {other}? No, thank you."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. I've looked at it so long, I think it's looking back."]},
            photo: {liked: ["'{title}'! Youngjin, who made ThingsPool, took this photo. Nice shot, Youngjin!"]},
            mirror: {liked: ["{Thing}! Hello, gorgeous. Oh wait, that's me."]},
            fan: {liked: ["{Thing}! Fans blow people around here. I call it a free flying lesson."]},
            door: {liked: ["{Thing}! Doors here open with a click. No keys to lose. My kind of door!"]},
            lamp: {liked: ["{Thing}! You can change a lamp's color here. I'd make every lamp a different color."]},
            sign: {liked: ["{Thing}. I read every sign twice. You never know when one will be funny."],
                disliked: ["{Thing}. Signs, signs, everywhere signs. Can't they draw a picture instead?"]},
        },
        words: {
            gush: ["I'd give [it|them] eleven out of ten", "[it|they] [makes|make] me want to dance",
                "[it|they] really [makes|make] my day"],
        },
    },
    sage: {
        love: ["{Thing}. I love {reason}. Simple things bring the most joy.",
            "Ah, {thing}. Few things please me as much as {reason}.",
            "{Thing}. I could sit with [it|them] for an hour. I love {reason}.",
            "Look at {thing}. {Gush}. I love {reason}."],
        like: ["{Thing}. I like {reason}. [It|They] [makes|make] this room calmer.",
            "{Thing} [is|are] {nice}. A small pleasure, and I enjoy {reason}.",
            "I like {thing}. It is good to stop and look at things."],
        meh: ["{Thing}. {Shrug}. But it is good to look at things slowly.",
            "{Thing}. Neither good nor bad, to me. Others may see more in [it|them].",
            "{Thing}. [It does|They do] not stir me much. That is all right too.",
            "{Thing}. {Shrug}. Still, someone put [it|them] here for a reason."],
        dislike: ["{Thing}. I have never cared for {reason}. Tastes differ, and that is fine.",
            "{Thing}? {Demur}. Still, someone made a choice here, and I respect it."],
        mixed: ["{Thing}. I love {reason}, yet not {other}. Most things are like that.",
            "{Thing}: {reason}, which I enjoy, and {other}, which I don't. Both can be true."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. A good picture asks you to slow down."]},
            photo: {liked: ["'{title}' is a photo by Youngjin, who made ThingsPool. He stopped to take it, and now we "
                + "stop to look."]},
            mirror: {liked: ["{Thing}. 'Know thyself' was carved at the temple of Apollo at Delphi. A mirror is a good "
                + "start."]},
            lamp: {liked: ["{Thing}. A little light makes a room feel safe."]},
            door: {liked: ["{Thing}. I like to wonder where a door leads before I go through it."]},
            sign: {liked: ["{Thing}. Clear words help everyone."]},
        },
        words: {
            shrug: ["[it is|they are] neither here nor there", "[it|they] [does|do] not move me much",
                "[it is|they are] fine, I suppose"],
        },
    },
    caretaker: {
        love: ["{Thing}. Now that's what I like to see. I love {reason}.",
            "{Thing}. Finally, something done right. I love {reason}.",
            "Hmph. {Thing}. Fine, I admit it: I love {reason}.", "{Thing}! I'd keep [it|them] spotless. Nothing beats "
            + "{reason}."],
        like: ["{Thing}. Not bad. I like {reason}, as long as nobody leaves blocks lying around.",
            "{Thing}. Hmph, {approve}. I like {reason}.", "{Thing}. Good. I've always liked {reason}."],
        meh: ["{Thing}. {Shrug}. As long as [it stays|they stay] put.",
            "{Thing}. Fine. Just don't build anything in front of [it|them].",
            "{Thing}. Hmph. Neither here nor there.", "{Thing}. {Shrug}. One more thing to look after."],
        dislike: ["{Thing}. Hmph. I've never liked {reason}. More dusting for me.",
            "{Thing}? {Demur}. But I'll look after [it|them] all the same."],
        mixed: ["{Thing}. I like {reason}, but {other}? Hmph.",
            "{Thing}. I love {reason}. I could do without {other}, though."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. Hung nice and straight. Good."]},
            photo: {liked: ["'{title}', a photo by Youngjin, who made ThingsPool. Hung nice and straight. Good."]},
            fan: {liked: ["{Thing}. Handy on a hot day, I suppose. Mind it doesn't blow you away."],
                disliked: ["{Thing}. Fans blow people all over the room. Hmph."]},
            lamp: {liked: ["{Thing}. A well-lit room is a safe room. Good."]},
            door: {liked: ["{Thing}. Keep the way to a door clear, I always say."]},
            sign: {liked: ["{Thing}. Signs keep order. I like order."]},
            mirror: {liked: ["{Thing}. Not a smudge on it. Good."]},
        },
        words: {
            approve: ["[it's|they're] in good shape", "[it|they] [looks|look] well kept", "[it|they] [suits|suit] "
                + "this room"],
        },
    },
    curator: {
        love: ["{Thing}! I love {reason}. Look at the colors!", "{Thing}. {Gush}. I love {reason}.",
            "Oh, {thing}. I'd put [it|them] in a museum. I love {reason}.", "{Thing}! Truly {lovely}. Nothing beats "
            + "{reason}."],
        like: ["{Thing}. I like {reason}, and the light here suits [it|them].",
            "{Thing} [is|are] {nice}. I've always liked {reason}.", "I like {thing}. The colors work well in this room."],
        meh: ["{Thing}. {Shrug}. The light here could be better, though.",
            "{Thing}. Not quite to my taste, but {approve}.",
            "{Thing}. Hmm. The colors are a little quiet for me.", "{Thing}. {Shrug}. I'd rather look at a painting."],
        dislike: ["{Thing}... I've never been fond of {reason}. But taste is a personal thing.",
            "{Thing}? {Demur}. I'd hang a painting there instead."],
        mixed: ["{Thing}. I love {reason}, though I've never liked {other}.",
            "{Thing}: {reason}, which I adore, and {other}, which I don't."],
        kinds: {
            art: {liked: ["'{title}' by {painter}. I love the colors in this one.",
                "{Painter} made '{title}'. I could stand here and look at it for an hour.",
                "'{title}' by {painter}. Step back a little: it looks even better from a few steps away."]},
            photo: {liked: ["'{title}' is a photo by Youngjin, who made ThingsPool. He has a fine eye for light!"]},
            lamp: {liked: ["{Thing}. {Color} light changes every color it falls on. I love that."]},
            mirror: {liked: ["{Thing}! Painters have used mirrors to paint themselves for hundreds of years."]},
            sign: {disliked: ["{Thing}. A sign is useful, but a painting there would be lovelier."]},
        },
    },
};
