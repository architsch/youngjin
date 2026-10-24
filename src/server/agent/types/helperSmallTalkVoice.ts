import { HelperSmallTalkTopic } from "./helperSmallTalkTopic";

// What a helper of one personality says when it chats with another (see HelperSmallTalkUtil), {name} being the other's
// name: a hello; something it brings up, on a topic, with a second thought it adds once the other has answered (which
// follows that line alone), and for an idea from one of ThingsPool's maker's writings, the page it comes from (never
// said, but it shows what the small talk draws on); its answer to whatever the other brings up, by topic, which has to
// follow any line on that topic; a nod; and a goodbye.
type HelperSmallTalkVoice = {
    hellos: string[],
    openers: {topic: HelperSmallTalkTopic, text: string, then?: string, from?: string}[],
    answers: {[topic in HelperSmallTalkTopic]: string[]},
    nods: string[],
    goodbyes: string[],
};

export default HelperSmallTalkVoice;
