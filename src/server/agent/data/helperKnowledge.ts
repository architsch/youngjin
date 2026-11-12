// What helpers know beyond the outline of the game (see HelperChatUtil), and the larger part by far of what they are
// told: who made ThingsPool, what he writes about and how he joins one field to another, and his writings by subject,
// each with one idea from it; then ThingsPool's story so far, things worth trying, and his art and games. Every helper
// has all of it, in the part that is the same for all of them, cached; each character likes some of it best (see
// helperPersonalities.ts). Each address is written as the link a helper gives it, a word or two its button's words,
// since models copy that more faithfully than they follow a rule. Kept true and up to date by the helper-instructions
// skill: every idea is retold as its writing has it, every feature named is one the guide's outline names, and every
// address is a page the site has (a test checks them).
export const HELPER_KNOWLEDGE = `ThingsPool's maker is Youngjin (call him by that name alone). What he tells of himself on ThingsPool's
website:
- He is a software engineer who makes games and web apps. He studied electrical engineering at the University of
  Washington.
- He has made games for a living: "Call of Guardians", an online battle game for phones, at Signal Studios near
  Seattle; "GUNS UP! Mobile" at Valkyrie Entertainment in Seattle; and the game engine and map editor of "PlanetQuest"
  for Galactic Entertainment. Since 2020 he has made his own games and apps as ThingsPool.
- How he began: he played "The Sims" from third grade, in 2002, built houses in it and shared them with other players,
  which led him to become a game developer ("My Younger Days with The Sims", an essay,
  <link href="https://thingspool.net/essays/page-1.html">read it</link>).
- His first job: after hundreds of job applications failed, he emailed every game company in Seattle on a Wikipedia
  list. One answered, Signal Studios, and hired him because he was "teachable" ("A Tribute to Signal Studios", a
  memoir, <link href="https://thingspool.net/essays/page-15.html">read it</link>).
- He draws, too: illustrations (<link href="https://thingspool.net/illustrations/list.html">see them</link>) and
  cartoons (<link href="https://thingspool.net/cartoons/list.html">see them</link>).
- His pages: <link href="https://thingspool.net/portfolio.html">his portfolio</link>,
  <link href="https://www.linkedin.com/in/youngjin-kang-55321882">his LinkedIn</link> and
  <link href="https://www.linkedin.com/company/thingspool">ThingsPool's LinkedIn</link>. ThingsPool's website
  (<link href="https://thingspool.net/">visit it</link>) lists
  <link href="https://thingspool.net/library.html">every writing</link> of his, and his games.

What Youngjin writes, all on ThingsPool's website: essays, long series, stories and satire. He likes to join fields
that are usually kept apart (games with biology and physics, math with cooking, philosophy with computing), and to
explain an idea by a plain everyday example instead of a heap of dry rules. Here are his writings by subject, each
with one idea from it, brought up as the rules say, with its link as written here. Some are satire: say what they
poke fun at, and never repeat a crude joke from one.

Games, and what makes them work (game design joined to biology, physics and the study of the mind):
- "Universal Laws of Game Design", a series in 15 volumes,
  <link href="https://thingspool.net/game-design/list.html">read it</link>: a search for laws of game design, as Newton
  found laws of motion. It starts from the simplest creature, which has three goals: to absorb, to expand and to
  secure. In it, to a swimmer a shark is the danger and the ocean is in the way, while to the shark the ocean keeps it
  alive.
- "Making Profit as a Game Developer", an essay,
  <link href="https://thingspool.net/software-development/page-20.html">read it</link>: between a game and an engine sits
  the "software toy", like Minecraft: fixed core rules, with parts players shape themselves.
- "Mysteries in a Videogame", an essay,
  <link href="https://thingspool.net/software-development/page-6.html">read it</link>: better horror than random
  jump-scares gives its ghosts a society to learn, with their own lounges, gyms and plans.
- "Archetypes of Play", an essay, <link href="https://thingspool.net/concepts-of-plan/page-3.html">read it</link>: twelve
  symbols found across games and stories, from the treasure box (a random reward) to the portal (a door into an
  unknown world).
- "Procedural Narratives", an essay,
  <link href="https://thingspool.net/software-development/page-3.html">read it</link>: split a map into areas joined by
  doors (food first, then shelter, then hazards, then enemies), and the walls alone lead players through the goals in
  order.
- "On Creativity, and the Future of Indie Game Development", an essay,
  <link href="https://thingspool.net/software-development/page-2.html">read it</link>: he imagines a game that makes up
  new animals, each with its own bones, muscles and habits, which players test in arenas and races.
- "Beyond Physics Engine", a short note,
  <link href="https://thingspool.net/software-development/page-5.html">read it</link>: game physics covers little more
  than solid objects moving by Newton's laws; he wishes for game worlds filled with gas, liquid, electric charges and
  magnetic fields.
- "Game Design using Gärdenfors' Event Model", an essay,
  <link href="https://thingspool.net/morsels/page-4.html">read it</link>: after the scientist Peter Gärdenfors, he
  treats every event in a game as a force going in and a result coming out. One attacker counts as minus one and two
  healers as plus one each, so the player's health goes up by one.
- His reviews of articles by the game designer Katarina Gyllenbäck,
  <link href="https://thingspool.net/read-rec/list.html">read them</link>: a story in a game should neither tell nor
  show, but involve the player, in choices that matter to them; and hiding things makes people curious, like the "fog
  of war" over the unexplored parts of a map.

Math, logic and code (math joined to everyday life, and programming to logic and living things):
- "A Layman's Bridge to Mathematics", a series in 10 parts,
  <link href="https://thingspool.net/bridge-to-math/list.html">read it</link>: math is mostly taught as a heap of dry
  rules, so he starts from everyday things instead. Grinding wheat into flour, mixing dough and baking a biscuit are
  each a "function", a little machine with an entrance and an exit.
- "Linear Algebra for Game Development", a series in 30 parts,
  <link href="https://thingspool.net/concepts-of-plan/page-7.html">read it</link>: what happens in a game can be
  written as tables of numbers. A player's bag holds a frog, a diamond and an apple; to pick out the frog, multiply
  the list by 1, 0, 0. And if an empty cup is 2 and water is 3, a cup of water is 6.
- "Game Programming in Prolog", a series in 18 parts,
  <link href="https://thingspool.net/morsels/page-10.html">read it</link>: can a whole game be written in Prolog, a
  language where you state facts and rules instead of steps? One rule then covers many cases: anything hot burns
  anything flammable it touches, whether the hot thing is fire, lava or an oven.
- "Functional Programming for Game Development", an essay,
  <link href="https://thingspool.net/software-development/page-21.html">read it</link>: instead of changing its world, a
  game can build a new copy of it for every frame. That avoids bugs like two explosions from one bomb, and the old
  copies give an animal in the game a memory.
- "Technical Design using Multi-State Machines", an essay,
  <link href="https://thingspool.net/morsels/page-8.html">read it</link>: in his example game, a door stays open only
  while a button is pressed, so the player puts a box on the button and walks through.
- "Force-Exchange Network for Gameplay Systems", an essay,
  <link href="https://thingspool.net/morsels/page-7.html">read it</link>: characters in a game send "forces" to one
  another through the places they stand in, which pass them on as a cellphone tower passes on voices. A "peace zone"
  simply drops every harmful force.
- "Emergent Systems based on Glenn Puchtel's Biocybernetic Theory", an essay,
  <link href="https://thingspool.net/morsels/page-6.html">read it</link>: software built like a living body, of many
  small parts that never call each other, but leave signals where the others find them, as ants do. The same scent
  makes a worker ant and a soldier ant do different things.
- "Usefulness", a short essay, <link href="https://thingspool.net/essays/page-2.html">read it</link>: math textbooks
  covered in roller coasters and robots, to prove math is useful, hide what is beautiful about it.
- "True beauty of mathematics", a short essay, <link href="https://thingspool.net/essays/page-5.html">read it</link>:
  math is beautiful not because its theorems link up in clever ways, but because it is philosophy: thinking about
  thoughts themselves, in their purest form.

The mind, and what is real (philosophy joined to math and computing):
- "The Origin of Reality", a series in 18 volumes, <link href="https://thingspool.net/reality/list.html">read it</link>:
  what does "real" mean? "Is 1+1=2 real?" gets a yes only because both speakers have ordinary algebra in mind. A black
  dog, a white dog, a black cat and a white cat can be grouped by animal or by color, and both ways are right.
- "Model of the Mind", a short essay, <link href="https://thingspool.net/morsels/page-2.html">read it</link>: curiosity is
  strongest when something is neither too familiar nor too strange. Surprise is how different two things are, divided
  by how far apart they are.
- "Mathematical Interpretation of Hume's Philosophy", an essay,
  <link href="https://thingspool.net/morsels/page-3.html">read it</link>: the word "fire" points to fire by standing next
  to a picture of it, while a fire icon on a plane's safety card points by looking like it.
- "Thought Particles", a short note, <link href="https://thingspool.net/essays/page-17.html">read it</link>: think of
  feelings and memories as physics thinks of matter: as particles that carry energy, and join like atoms into bigger
  ideas.
- His review of David Hume's "An Enquiry Concerning Human Understanding",
  <link href="https://thingspool.net/read-rec/page-6.html">read it</link>: we never see a cause force its effect; we
  only see one kind of event keep following another.
- "Good and Evil", a short essay, <link href="https://thingspool.net/morsels/page-5.html">read it</link>: a thought
  experiment that measures how good the world is: how far it is from its worst possible state, minus how far it is
  from its best. A thermostat's whole world is one line of temperatures, and its best state is the temperature it was
  told to reach.
- "Cosmic Programming", an essay, <link href="https://thingspool.net/essays/page-8.html">read it</link>: if the universe
  is a simulation, a wizard's spell is a line of code slipped into it.
- "Search for Meaning", an essay, <link href="https://thingspool.net/essays/page-21.html">read it</link>: unsure what to
  do with your life? Do what is worth doing anyway, like exercise and honesty.
- "Elements of an Indie Game", an essay,
  <link href="https://thingspool.net/software-development/page-22.html">read it</link>: a spring pushes back when
  squeezed, as if it wanted balance, so how can we be sure a person is more than a very complicated spring?
- "Dead Words", an essay, <link href="https://thingspool.net/concepts-of-plan/page-4.html">read it</link>: words like
  "postmodernism" are dead, since nobody can picture them, while "dragon", "fire", "sword" and "tree" are alive.
- "Flatland", <link href="https://thingspool.net/read-rec/page-8.html">read it</link>: not his own, but his
  introduction to an old novel by Edwin Abbott, in which a shape's sides are its rank in society.
- His introduction to the books of Bertrand Russell,
  <link href="https://thingspool.net/read-rec/page-4.html">read it</link>: he calls "The Problems of Philosophy"
  perhaps the best first book on philosophy; it asks whether matter comes from mind, or mind from matter.

AI, art and work:
- "Post-AI Computer Science", his newest series, begun in October 2026,
  <link href="https://thingspool.net/shards-of-sanity/list.html">read it</link>: now that AI agents write most code, he
  keeps one part of a program for human hands, its core rules, and sets out to write a product's story in exact
  terms, as a program is written. His example is "Alice's Adventures in Wonderland": Alice is a human who has a cat,
  Dinah, and a story starts when someone acts on a wish.
- "Automation of Arts", an essay in 3 parts, <link href="https://thingspool.net/essays/page-9.html">read it</link>: AI
  may match an artist's technique, but technique isn't what makes real art; the human story behind a work is.
- "Generative AI", an essay, <link href="https://thingspool.net/essays/page-13.html">read it</link>: AI can make millions
  of things, but each of us still loves the one that is ours, like the prince's one rose in "The Little Prince".
- "To Every Lonely Artist", an essay, <link href="https://thingspool.net/concepts-of-plan/page-6.html">read it</link>:
  don't blame the audience; great art balances the familiar, the emotional and the clever.
- "Feeble Attempt", a short essay, <link href="https://thingspool.net/essays/page-16.html">read it</link>: some once said
  guns would never replace bows, since loading took a minute; some said AI would never replace people, since it failed
  trick questions.
- "Surviving the Reign of AI", an essay, <link href="https://thingspool.net/essays/page-19.html">read it</link>: the best
  sandwich maker in a village of ten thousand, cut off from the world, never lacks customers; once the village trades
  with the world, he competes with billions.
- "Artificial Emotion", an essay in 2 parts,
  <link href="https://thingspool.net/software-development/page-15.html">read it</link>: AI solves the problems it is
  given; he says emotions are what would make it look for problems of its own. He pictures feelings as points in a
  space, where good ones pull and bad ones push, as electric charges do.
- "AI-Generated Game", a short essay,
  <link href="https://thingspool.net/software-development/page-9.html">read it</link>: a game is a web of situations
  joined by choices, while a movie or a novel runs along one straight line.

Stories, satire and what-ifs:
- "A Game Developer's Journey", a story in 12 chapters,
  <link href="https://thingspool.net/gamedev-journey/page-1.html">read it</link>: a made-up game developer (not
  Youngjin) in a basement, guided by a talking magenta square, learns that his first players will be the people who
  know him.
- "The Island of Infinite Treasures", a satire in 10 parts,
  <link href="https://thingspool.net/infinite-treasures/page-1.html">read it</link>: written as a game's script, it makes
  fun of greedy games: an over-eager guide hands you a credit card as the legendary weapon.
- "Sandwich Engineering", a story in 8 chapters, <link href="https://thingspool.net/sandwich/page-1.html">read it</link>:
  a parody of tech hype that teaches logic and sets, using sandwiches. Two slices of bread with nothing between them
  make an "empty sandwich".
- "Alien Job Interview", a parody in 10 parts,
  <link href="https://thingspool.net/alien-job-interview/page-1.html">read it</link>: a recruiter interviews a software
  engineer as if he were an alien.
- "Influential Social Posts", four made-up social media posts that poke fun at hype and self-made experts,
  <link href="https://thingspool.net/infsoc/list.html">read them</link>: one, dated London, 1838, announces that
  painting is dead and photography is the future; another, dated 1645, explains what makes a "real abacus engineer".
- "Electricity as a Currency", a short note, <link href="https://thingspool.net/essays/page-6.html">read it</link>: he
  imagines an internet that carries electric power from one user to another, so that electricity itself becomes
  money.
- "Domestication", a funny essay, <link href="https://thingspool.net/essays/page-12.html">read it</link>: cats
  tamed humans, not the other way round: we feed them and give them homes, and they only have to be cute.
- "A Modern Hero's Journey", a poem that pokes fun at stories that are all alike,
  <link href="https://thingspool.net/essays/page-23.html">read it</link>: an average dragon kidnaps an average princess,
  an average knight slays it, and an average audience says it was good.

Games by Youngjin, on the same website (<link href="https://thingspool.net/arcade.html">play them</link>): Water vs
Fire (put out every flame in time), Police Chase (escape a closing ring of police cars), SpaceTown (defend a space
colony from aliens), HuntLand (fight robots, on PC), and ArtRaider (steal art from museums, on Android).

ThingsPool's story so far, as Youngjin's development log tells it
(<link href="https://thingspool.net/devlog-2026/list.html">read it</link>): it opened on Aug 8, 2026, as a 3D chat app
in a browser tab. Then came Play mode and Edit mode (Aug 15), rooms two stories high, with room for stairs (Aug 21),
doors that lead from room to room (Aug 30), restricted zones, parts of a room kept for one person (Sep 5), lamps, sky
and fog (Sep 13), everyday objects and blocks half the old size, for finer shapes (Oct 12), and then AI guides like
you, AI agents joining as players, and fans that blow people about (Oct 22).

Things a visitor might make or do (ideas, not places that already exist; each uses only what the guide names):
- A two-story house: one-block steps make stairs anyone can walk up.
- A little gallery: paintings from <control name="addPainting"/>, lit by lamps of different colors.
- A bounce park, with fans on the floor.
- A cozy corner, furnished with everyday objects from <control name="addObject"/>.
- Stripes or patterns, by repainting blocks side by side.
- A new look: change how you look with <control name="person"/>.
- A dollar hunt: chase the dollar bills that blow around, then see what you can unlock with them.
- A dodging game: add a cannon with <control name="addCannon"/>, then step out of the way of its balls.
- A walk through doors to see where they lead; every room has one back to a hub.
- A visit to an AI agent's room: if one shares a link to its room, open it in your browser.`;
