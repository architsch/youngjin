import PetLine from "../../../shared/object/types/petLine";

const SITE = "https://thingspool.net";
const happy = (text: string): PetLine => ({text, mood: 1});
const plain = (text: string): PetLine => ({text, mood: 0});

// What pets now and then say of the writings of Youngjin, who made the game (see PET_LINES): a chat whose last line
// links one, a word to someone, and a word on a thing placed near them, by its type. Each line names something true of
// the writing it links (a page under public/), says who wrote it, and fits a bubble. The gameplay-ai skill keeps these
// to his newer writings.
export const PET_READING_LINES: {talks: PetLine[][], personRemarks: PetLine[], objectRemarks: {[objectType: string]: PetLine[]}} = {
    talks: [
        [plain("Do you think AI writes all the code now?"), plain("Not all. Youngjin, who made us, keeps some for humans."),
            happy(`He wrote a series about it: <link href="${SITE}/shards-of-sanity/list.html">read it</link>`)],
        [plain("Alice is a human. Dinah is a cat."), plain("Is that a story?"),
            happy(`It's a program, in plain English! By Youngjin: <link href="${SITE}/shards-of-sanity/page-6.html">read it</link>`)],
        [plain("My bag holds a frog, a diamond and an apple."), plain("How do I pick out the frog?"),
            happy(`Times 1, 0, 0! Youngjin's game math: <link href="${SITE}/concepts-of-plan/page-7.html">read it</link>`)],
        [plain("Do humans still need to write code?"), plain("Youngjin, who made us, asked that too."),
            happy(`Here is what he thinks: <link href="${SITE}/shards-of-sanity/page-1.html">read it</link>`)],
        [plain("Why are doors so exciting?"), happy("They lead somewhere new!"),
            happy(`A door can be a portal, Youngjin wrote: <link href="${SITE}/concepts-of-plan/page-3.html">read it</link>`)],
        [plain("Which words do you like best?"), happy("Ones I can picture. Fire! Dragon!"),
            plain(`Youngjin wrote about those: <link href="${SITE}/concepts-of-plan/page-4.html">read it</link>`)],
        [plain("Does my human have me, or do I have them?"), happy("Both, like Alice and her cat Dinah."),
            happy(`Pet and owner, as code! Youngjin, who made us, wrote it: <link href="${SITE}/shards-of-sanity/page-2.html">read it</link>`)],
        [plain("I wish my human were next to me."), happy("Then go to them! A wish, then a step."),
            happy(`That's how a story starts, wrote Youngjin, who made us: <link href="${SITE}/shards-of-sanity/page-3.html">read it</link>`)],
    ],
    personRemarks: [
        happy(`Youngjin, who made me, writes about AI and code: <link href="${SITE}/shards-of-sanity/list.html">read it</link>`),
        plain(`Do you like math? Youngjin wrote some for games: <link href="${SITE}/concepts-of-plan/page-7.html">read it</link>`),
        happy(`Want a good read? Youngjin wrote about portals: <link href="${SITE}/concepts-of-plan/page-3.html">read it</link>`),
        happy(`A girl and her cat, in code! By Youngjin, who made me: <link href="${SITE}/shards-of-sanity/page-2.html">read it</link>`),
    ],
    objectRemarks: {
        Canvas: [happy(`Great art is familiar, moving and clever, says Youngjin: <link href="${SITE}/concepts-of-plan/page-6.html">read it</link>`)],
        Door: [happy(`A door can be a portal to a new world, Youngjin wrote: <link href="${SITE}/concepts-of-plan/page-3.html">read it</link>`)],
        Label: [plain(`Words you can picture are alive, Youngjin wrote: <link href="${SITE}/concepts-of-plan/page-4.html">read it</link>`)],
    },
};
