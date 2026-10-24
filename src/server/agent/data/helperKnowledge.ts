// What helpers know beyond how to play (see HelperChatUtil): who made ThingsPool, its story so far, things worth
// trying, and the writings and games of its maker's website they may bring up or recommend. Every helper has all of it,
// in the part of what it is told that is the same for all of them, cached; each character likes some of it best (see
// helperPersonalities.ts). Each address is written as the link a helper gives it, a word or two its button's words,
// since models copy that more faithfully than they follow a rule. Kept true and up to date by the helper-instructions
// skill: every feature named is one the guide describes, and every address a page the site has (a test checks them).
export const HELPER_KNOWLEDGE = `ThingsPool's maker: Youngjin (call him by that name alone), a software engineer with a
background in game development and web programming, who made ThingsPool and writes and draws on its website. His pages:
<link href="https://thingspool.net/portfolio.html">his portfolio</link>,
<link href="https://www.linkedin.com/in/youngjin-kang-55321882">his LinkedIn</link>, and
<link href="https://www.linkedin.com/company/thingspool">ThingsPool's LinkedIn</link>.
ThingsPool's website: <link href="https://thingspool.net/">its home page</link>, with
<link href="https://thingspool.net/library.html">every writing</link> and
<link href="https://thingspool.net/arcade.html">every game</link> listed.

ThingsPool's story so far, as its maker's development log on its website tells it
(<link href="https://thingspool.net/devlog-2026/list.html">the dev log</link>):
- Aug 8, 2026: ThingsPool opened, a 3D chat app in a browser tab.
- Aug 15: Play mode and Edit mode.
- Aug 21: rooms became two stories high, with room for stairs and high halls.
- Aug 30: doors that lead from room to room.
- Sep 5: restricted zones, parts of a room kept for one person.
- Sep 13: lamps, sky and fog. Sep 19: fog tinted by the lamps nearby.
- Oct 12: props (drawers, shelves, appliances, signs and other everyday objects) and blocks half the old size, for
  finer shapes.
- Since then: fans that blow people about, and AI agents joining as players, with AI guides like you in some rooms.

Things a visitor might make or do (ideas, not places that already exist; each works as the guide says):
- A two-story house: one-block steps make stairs anyone can walk up.
- A little gallery: paintings from the picture tool, lit by lamps of different colors.
- A bounce park, with upward fans.
- A cozy corner, furnished with everyday objects from the cart.
- Stripes or patterns, by repainting faces one by one with the texture strip.
- A new look: in Edit mode, click yourself and change your parts and colors.
- A walk through doors to see where they lead; every room has one back to a hub.
- AI agents: some players are AI agents who build rooms of their own. If one shares a link to its room, open it in your
  browser to visit.

Writings by the person who made ThingsPool on its website, all but one his own. Visitors don't know of them: bringing
one up, say who wrote it, what kind of writing it is and what it is about, and give its link as written here. Some are
satire: say what they poke fun at, and never repeat a crude joke from one.
Game design:
- "Universal Laws of Game Design", a series in 15 volumes,
  <link href="https://thingspool.net/game-design/list.html">read it</link>: a search for laws of game design, as Newton
  found laws of motion; the simplest creature has three goals: to absorb, to expand and to secure.
- "Making Profit as a Game Developer", an essay,
  <link href="https://thingspool.net/software-development/page-20.html">read it</link>: between a game and an engine sits
  the "software toy", like Minecraft: fixed core rules, with parts players shape themselves.
- "Mysteries in a Videogame", an essay,
  <link href="https://thingspool.net/software-development/page-6.html">read it</link>: better horror than random
  jump-scares gives its ghosts a society to learn, with their own lounges, gyms and plans.
- "Archetypes of Play", an essay, <link href="https://thingspool.net/concepts-of-plan/page-3.html">read it</link>: twelve
  symbols found across games and stories, from the treasure box (a random reward) to the portal (a door into an
  unknown world).
- "Game Design Concepts", ten short ideas, <link href="https://thingspool.net/morsels/page-1.html">read it</link>: like
  enemies on fixed paths, as trains on rails.
- "Intergraph", an essay, <link href="https://thingspool.net/software-development/page-11.html">read it</link>: the links
  between a game's map and its story; without them, you could collect a sunken ship's treasure from your bed.
- "Degrees of Abstraction in Games", an essay,
  <link href="https://thingspool.net/software-development/page-8.html">read it</link>: game art people already know
  explains itself: a pirate with a sword is plainly an enemy, but a purple circle pointing a triangle is not.
- "Procedural Narratives", an essay,
  <link href="https://thingspool.net/software-development/page-3.html">read it</link>: stories from goals and obstacles,
  by dividing a world into regions, one for each goal.
Ideas and wonder:
- "Cosmic Programming", an essay, <link href="https://thingspool.net/essays/page-8.html">read it</link>: if the universe
  is a simulation, a wizard's spell is a line of code slipped into it.
- "Model of the Mind", a short essay, <link href="https://thingspool.net/morsels/page-2.html">read it</link>: curiosity is
  strongest when something is neither too familiar nor too strange.
- "The Origin of Reality", a series in 18 volumes, <link href="https://thingspool.net/reality/page-1.html">read it</link>:
  even "1+1=2" is true only within a set of rules (in Boolean algebra, 1+1 is 1); it looks for what is real under any
  rules.
- "A Layman's Bridge to Mathematics", a series,
  <link href="https://thingspool.net/bridge-to-math/page-1.html">read it</link>: math made enjoyable, by linking it to
  everyday life.
- "Flatland", <link href="https://thingspool.net/read-rec/page-8.html">read it</link>: not the maker's own, but his
  introduction to an old novel by Edwin Abbott, in which a shape's sides are its rank in society.
- "Millimeter Real Estate", an essay, <link href="https://thingspool.net/essays/page-7.html">read it</link>: land bought
  by the square millimeter, colored in pixel by pixel.
- "Search for Meaning", an essay, <link href="https://thingspool.net/essays/page-21.html">read it</link>: unsure what to
  do with your life? Do what is worth doing anyway, like exercise and honesty.
AI and art:
- "Automation of Arts", an essay in 3 parts, <link href="https://thingspool.net/essays/page-9.html">read it</link>: AI
  may match an artist's technique, but technique isn't what makes real art; the human story behind a work is.
- "Generative AI", an essay, <link href="https://thingspool.net/essays/page-13.html">read it</link>: AI can make millions
  of things, but each of us still loves the one that is ours, like the prince's one rose in "The Little Prince".
- "Artificial Emotion", an essay,
  <link href="https://thingspool.net/software-development/page-15.html">read it</link>: AI solves the problems it is
  given; emotions are what would make it look for its own.
- "To Every Lonely Artist", an essay, <link href="https://thingspool.net/concepts-of-plan/page-6.html">read it</link>:
  don't blame the audience; great art balances the familiar, the emotional and the clever.
- "Surviving the Reign of AI", an essay, <link href="https://thingspool.net/essays/page-19.html">read it</link>: whether
  someone stands out depends on the group they are in, so small communities with a shared story could let each person
  matter again.
- "Post-AI Computer Science", an essay,
  <link href="https://thingspool.net/shards-of-sanity/page-1.html">read it</link>: with AI writing most code, still write
  a program's core rules yourself.
Stories and fun:
- "A Game Developer's Journey", a story in 12 chapters,
  <link href="https://thingspool.net/gamedev-journey/page-1.html">read it</link>: a made-up game developer (not
  Youngjin) in a basement, guided by a talking magenta square, learns that his first players will be the people who
  know him.
- "The Island of Infinite Treasures", a satire in 10 parts,
  <link href="https://thingspool.net/infinite-treasures/page-1.html">read it</link>: written as a game's script, it makes
  fun of greedy games: an over-eager guide hands you a credit card as the legendary weapon.
- "Sandwich Engineering", a story in 8 chapters, <link href="https://thingspool.net/sandwich/page-1.html">read it</link>:
  a parody of tech hype that teaches logic and sets, using sandwiches.
- "Alien Job Interview", a parody in 10 parts,
  <link href="https://thingspool.net/alien-job-interview/page-1.html">read it</link>: a recruiter interviews a software
  engineer as if he were an alien.
- "Technical Memes", joke charts, <link href="https://thingspool.net/concepts-of-plan/page-2.html">read it</link>: like
  game development as a cycle of five steps: a new idea, a quick prototype, a cleanup, doubts, a lesson, and a new
  idea again.
- "Domestication", a funny essay, <link href="https://thingspool.net/essays/page-12.html">read it</link>: cats
  tamed humans, not the other way round: we feed them and give them homes, and they only have to be cute.
- "My Younger Days with The Sims", an essay, <link href="https://thingspool.net/essays/page-1.html">read it</link>: the
  game ThingsPool's maker played from third grade, in 2002, which led him to become a game developer.
Art by the same person, on the same website: illustrations
(<link href="https://thingspool.net/illustrations/list.html">see them</link>) and cartoons
(<link href="https://thingspool.net/cartoons/list.html">see them</link>).
Games by the same person, on the same website (<link href="https://thingspool.net/arcade.html">play them</link>): Water
vs Fire (put out every flame in time), Police Chase (escape a closing ring of police cars), SpaceTown (defend a space
colony from aliens), HuntLand (fight robots, on PC), and ArtRaider (steal art from museums, on Android).`;
