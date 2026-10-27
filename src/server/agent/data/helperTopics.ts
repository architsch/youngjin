import { NpcPersonality } from "../../../shared/object/types/npcPersonality";

// What each played personality has on its mind (see helperPersonalities.ts), to bring up when a visitor leaves the
// subject to it: a few of them, picked at random, go with each talk (see HelperChatUtil), so that every helper talks of
// many different things, each in its own field. Each is a plain, true statement about something named: from the wide
// world (only facts that are well known and certain), or from one of ThingsPool's maker's writings, with the link a
// helper gives it, a word or two its button's words (every address a page the site has; a test checks them). Only the
// few picked are ever sent, so the lists cost nothing to grow. Kept by the helper-instructions skill.
export const HELPER_TOPICS: {[personality in Exclude<NpcPersonality, "idle">]: string[]} = {
    guide: [
        "The Rosetta Stone, found in Egypt in 1799, has the same text in three scripts. It helped Jean-François "
            + "Champollion read Egyptian hieroglyphs in 1822.",
        "Louis Braille made his alphabet of raised dots for blind readers in France when he was 15. Each letter is a "
            + "pattern of up to six dots.",
        "Ray Tomlinson sent the first email between computers in 1971, and picked the @ sign to join a person's name to "
            + "a computer's name.",
        "The QR code was invented in 1994 by Masahiro Hara at Denso Wave, a Japanese company, to keep track of car "
            + "parts in factories.",
        "Morse code turns letters into dots and dashes. The call for help, SOS, is three dots, three dashes and three "
            + "dots.",
        "The Prime Meridian, longitude 0, runs through Greenwich in London. Every place on Earth is measured east or "
            + "west of it.",
        "A leap year adds February 29 almost every four years, because a year is about 365 and a quarter days long.",
        "Esperanto is a language L. L. Zamenhof made up in 1887, meant to be easy for anyone in the world to learn.",
        "Melvil Dewey made the Dewey Decimal System in 1876. Many libraries still shelve books by its numbers, like 500 "
            + "for science.",
        "The first electric traffic light was put up in Cleveland, Ohio, in 1914.",
        "Paper money was first used in China, about 1,000 years ago, during the Song dynasty.",
        "Pierre de Coubertin designed the five Olympic rings in 1913, one for each of five parts of the world.",
        "In Hawaiian, \"aloha\" means hello and goodbye, and also love.",
        "China is wide enough for about five time zones, yet the whole country keeps one clock time, Beijing Time.",
        "Anders Celsius made his temperature scale in 1742 with water boiling at 0 and freezing at 100. Others soon "
            + "turned it the other way round.",
        "The oldest photograph that still exists was taken around 1826 in France by Nicéphore Niépce, from a window. "
            + "It needed hours of light.",
        "George de Mestral, a Swiss engineer, invented Velcro after looking under a microscope at the burrs stuck in "
            + "his dog's fur.",
        "Spencer Silver made a weak glue at 3M in 1968. Years later, Art Fry used it for bookmarks that wouldn't fall "
            + "out, and Post-it Notes were born.",
        "The first website, made by Tim Berners-Lee at CERN, went online in 1991. You can still visit it today.",
        "Since 2019, the kilogram has been defined by a constant of nature. Before that, it was the weight of a metal "
            + "cylinder kept near Paris.",
        "The meter was first defined in the 1790s as one ten-millionth of the distance from the North Pole to the "
            + "equator.",
        "British Sign Language and American Sign Language are so different that their users can't easily understand "
            + "each other.",
        "Italians say \"ciao\" for both hello and goodbye. It comes from an old Venetian phrase meaning \"your "
            + "servant\".",
        "ZIP codes came to the United States in 1963, to help sort the growing piles of mail.",
        "The University of al-Qarawiyyin in Fez, Morocco, founded in 859 by Fatima al-Fihri, is often called the "
            + "oldest university still running.",
        "\"A Tribute to Signal Studios\", Youngjin's memoir of his first job (<link "
            + "href=\"https://thingspool.net/essays/page-15.html\">read it</link>): after hundreds of job applications "
            + "failed, he emailed every game company in Seattle on a Wikipedia list. One answered, and hired him, "
            + "because he was \"teachable\".",
        "\"Creating a Game from Scratch\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-7.html\">read it</link>): a team of three or "
            + "four can't match a big studio, so he suggests simple rules like those of chess or Go, and plain shapes "
            + "like billiard balls for the art.",
        "\"A Layman's Bridge to Mathematics\", Youngjin's series linking math to everyday life (<link "
            + "href=\"https://thingspool.net/bridge-to-math/page-2.html\">read it</link>): grinding wheat into flour, "
            + "mixing dough and baking a biscuit are each a \"function\", a little machine with an entrance and an "
            + "exit.",
        "Youngjin's review of an article by the game designer Katarina Gyllenbäck (<link "
            + "href=\"https://thingspool.net/read-rec/page-7.html\">read it</link>): rewards and punishments can push "
            + "out real curiosity, so a good experience starts from a goal people want for themselves.",
    ],
    builder: [
        "The Pantheon in Rome, finished around 126 AD, still has the largest dome of plain, unreinforced concrete in "
            + "the world, with an open hole at its top.",
        "The Golden Gate Bridge is painted \"International Orange\", a color chosen partly so that ships could see it "
            + "in San Francisco's fog.",
        "Filippo Brunelleschi finished the great dome of Florence Cathedral in 1436, building it without the usual "
            + "wooden frame underneath.",
        "Gustave Eiffel's company built the iron frame inside the Statue of Liberty, a few years before the Eiffel "
            + "Tower.",
        "The Leaning Tower of Pisa began to lean in the 1170s, while it was still being built, because the ground under "
            + "it is soft.",
        "Antoni Gaudí planned his arches with hanging chains and little bags of weight, then turned the shapes upside "
            + "down.",
        "An igloo is built from snow blocks laid in a rising spiral. Snow holds air, so inside it can be far warmer "
            + "than outside.",
        "The Inca built walls at Machu Picchu without mortar. The best stones fit so tightly that a knife blade won't "
            + "go between them.",
        "The Falkirk Wheel in Scotland, opened in 2002, is a giant turning boat lift that raises boats 24 meters "
            + "between two canals.",
        "The Millau Viaduct in France, opened in 2004, is the tallest bridge in the world: one of its masts reaches 343 "
            + "meters.",
        "Tower Bridge in London, finished in 1894, lifts its two road halves so that tall ships can pass underneath.",
        "The Colosseum in Rome had a huge cloth roof, the velarium, which sailors pulled over the seats to shade the "
            + "crowd.",
        "The biggest stones of Stonehenge weigh about 25 tons each, and its smaller bluestones came from Wales, about "
            + "240 km away.",
        "Habitat 67 in Montreal, built for the 1967 World's Fair, is 354 concrete boxes stacked up to make homes.",
        "A LEGO brick made today still fits a LEGO brick made in 1958, the year its shape was patented.",
        "The Hoover Dam, finished in 1936, holds enough concrete to pave a two-lane road from San Francisco to New "
            + "York.",
        "Weaver birds build hanging nests from strips of grass, and some even tie knots in them.",
        "Termites in Africa build mounds taller than a person, with tunnels inside that let air flow through.",
        "The four towers around the Taj Mahal lean slightly outward, so that in an earthquake they would fall away from "
            + "the tomb.",
        "The Empire State Building went up in about 410 days and opened in 1931.",
        "Frank Lloyd Wright's house Fallingwater, from the 1930s, stands right over a waterfall in Pennsylvania.",
        "George Ferris built the first Ferris wheel for the 1893 World's Fair in Chicago. Each of its 36 cars held "
            + "about 60 people.",
        "The Petronas Towers in Kuala Lumpur were the tallest buildings in the world from 1998 to 2004. A bridge joins "
            + "them on the 41st and 42nd floors.",
        "A geodesic dome, made famous by Buckminster Fuller, is built from triangles, the shape that keeps its form "
            + "best under weight.",
        "The Panama Canal, opened in 1914, lifts ships about 26 meters with locks to carry them between the Atlantic "
            + "and the Pacific.",
        "The Pont du Gard in France, a Roman bridge that carried water about 2,000 years ago, stands on stone arches "
            + "to this day.",
        "Ernő Rubik, a Hungarian teacher of design, made the first Rubik's Cube in 1974 to help his students think in "
            + "three dimensions.",
        "The Crystal Palace, built in London for the Great Exhibition of 1851, was made of about 300,000 panes of "
            + "glass.",
        "\"Universal Laws of Game Design\", Youngjin's series in 15 volumes (<link "
            + "href=\"https://thingspool.net/game-design/page-15.html\">read it</link>): its last volume pictures a "
            + "game world as a grid of cubes, where every place is just a row and a column, as ThingsPool's rooms "
            + "are grids of blocks.",
        "\"Analogue Memory Storage\", a short essay by Youngjin (<link "
            + "href=\"https://thingspool.net/essays/page-14.html\">read it</link>): he imagines a computer that keeps a "
            + "3D model as a tiny 3D-printed copy, and scans the copy whenever it needs to show the model.",
        "\"Technical Design using Multi-State Machines\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/morsels/page-8.html\">read it</link>): in his example game, a door stays "
            + "open only while a button is pressed, so the player puts a box on the button and walks through.",
        "\"Game Design Concepts\", ten short ideas by Youngjin (<link "
            + "href=\"https://thingspool.net/morsels/page-1.html\">read it</link>): draw a game's land as a picture, "
            + "where brightness is height and color is the kind of place, and blurring the picture wears the land "
            + "down.",
        "\"On Creativity, and the Future of Indie Game Development\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-2.html\">read it</link>): he imagines a game "
            + "that makes up new animals, each with its own bones, muscles and habits, which players test in arenas "
            + "and races.",
        "\"Prototyping\", a short note by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-17.html\">read it</link>): start a game by "
            + "building a tool, even your own game engine, since a game's story and theme often change along the way.",
        "\"Sandwich Engineering\", Youngjin's story in 8 chapters that pokes fun at tech hype (<link "
            + "href=\"https://thingspool.net/sandwich/page-8.html\">read it</link>): in its last chapter, a machine "
            + "that can only move, hold and drop makes a ham sandwich from a short list of commands.",
        "\"Post-AI Computer Science\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/shards-of-sanity/page-1.html\">read it</link>): with AI writing most "
            + "code, still write a program's core rules yourself.",
    ],
    explorer: [
        "The Mariana Trench is nearly 11 km deep. In 2012, the film director James Cameron dove to its bottom alone.",
        "Roald Amundsen's team reached the South Pole first, on December 14, 1911, with dog sleds.",
        "Edmund Hillary and Tenzing Norgay were the first people known to stand on top of Mount Everest, on May 29, "
            + "1953.",
        "The Sahara is almost as big as the whole United States.",
        "Ferdinand Magellan's ships were the first to sail all the way around the world, from 1519 to 1522. Magellan "
            + "himself died on the way.",
        "In the Waitomo Caves of New Zealand, thousands of glowworms make the cave ceilings glow blue-green.",
        "Angel Falls in Venezuela is the tallest waterfall in the world, almost 1 km high.",
        "The Dead Sea is so salty that people float on it without trying. Its shore is the lowest land on Earth, over "
            + "400 meters below sea level.",
        "Son Doong Cave in Vietnam is so big that it has its own jungle, and even clouds, inside.",
        "Ibn Battuta, from Morocco, traveled about 120,000 km in the 1300s, from West Africa to China.",
        "Zheng He, a Chinese admiral, led seven voyages across the Indian Ocean between 1405 and 1433, with fleets of "
            + "hundreds of ships.",
        "The Amazon carries more water than any other river: about a fifth of all the river water that reaches the "
            + "oceans.",
        "Lake Baikal in Siberia is the deepest lake on Earth, about 1,600 meters, and holds about a fifth of the "
            + "world's unfrozen fresh water.",
        "The Giant's Causeway in Northern Ireland is about 40,000 stone columns, most with six sides, made by cooling "
            + "lava. A legend says a giant built it.",
        "Göbekli Tepe in Turkey has carved stone pillars about 11,000 years old, older than Stonehenge and the "
            + "pyramids.",
        "Easter Island, in the Pacific, has nearly 1,000 giant stone statues called moai.",
        "The Atacama Desert in Chile is so dry that scientists test Mars rovers there.",
        "Charles Darwin visited the Galápagos Islands in 1835. Their giant tortoises can live for over 100 years.",
        "The Svalbard Global Seed Vault, inside a frozen mountain in Norway, keeps over a million kinds of seeds safe.",
        "Pompeii was buried by the volcano Vesuvius in 79 AD and dug up again from the 1700s, its streets and houses "
            + "still in place.",
        "Measured from the ocean floor, Mauna Kea in Hawaii is over 10,000 meters tall, taller than Mount Everest.",
        "The Silk Road was a web of trade routes between China and the Mediterranean. Silk, paper and ideas all "
            + "traveled along it.",
        "Jacques Cousteau and Émile Gagnan made the Aqua-Lung in 1943, which let divers breathe underwater on their "
            + "own.",
        "Yuri Gagarin became the first person in space on April 12, 1961. His flight around the Earth took 108 "
            + "minutes.",
        "Mount Kilimanjaro in Tanzania, the tallest mountain in Africa, has snow on top though it stands near the "
            + "equator.",
        "Humpback whales swim up to about 8,000 km between their feeding waters and their breeding waters.",
        "Angkor Wat in Cambodia, built in the 1100s, is shown on Cambodia's flag.",
        "Neil Armstrong and Buzz Aldrin landed on the Moon on July 20, 1969. Their footprints are still there, as the "
            + "Moon has no wind.",
        "Pamukkale in Turkey has bright white terraces of mineral rock, filled with warm spring water.",
        "\"Universal Laws of Game Design\", Youngjin's series in 15 volumes (<link "
            + "href=\"https://thingspool.net/game-design/page-14.html\">read it</link>): he imagines a vending "
            + "machine in the sea that gives a dolphin a fish for every piece of plastic it brings, to clean the "
            + "ocean.",
        "\"Universal Laws of Game Design\", Youngjin's series in 15 volumes (<link "
            + "href=\"https://thingspool.net/game-design/page-3.html\">read it</link>): to a swimmer, a shark is the "
            + "danger and the ocean is in the way; to the shark, the ocean keeps it alive, and a person with a spear "
            + "is the danger.",
        "\"Procedural Narratives\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-3.html\">read it</link>): split a map into "
            + "areas joined by doors (food first, then shelter, then hazards, then enemies), and the walls alone lead "
            + "players through the goals in order.",
        "\"Archetypes of Play\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/concepts-of-plan/page-3.html\">read it</link>): a compass helps you "
            + "focus on one goal at a time, while a map shows every goal at once, which can be too much.",
        "Youngjin's review of an article by the game designer Katarina Gyllenbäck (<link "
            + "href=\"https://thingspool.net/read-rec/page-3.html\">read it</link>): hiding things makes people "
            + "curious, like the \"fog of war\" that covers the unexplored parts of a map in video games.",
        "\"Future of Game Development - 3\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-14.html\">read it</link>): is Microsoft Flight "
            + "Simulator a game? It depends on how you play it: for fun it is a game, for training it is a "
            + "simulation.",
        "\"Model of the Mind\", a short essay by Youngjin (<link "
            + "href=\"https://thingspool.net/morsels/page-2.html\">read it</link>): something strange surprises you "
            + "more the closer it is: surprise is how different two things are, divided by how far apart they are.",
        "\"Intergraph\", an essay by Youngjin (<link href=\"https://thingspool.net/software-development/page-11.html\">"
            + "read it</link>): the links between a game's map and its story; without them, you could collect a sunken "
            + "ship's treasure from your bed.",
    ],
    storyteller: [
        "In the folk tales of the Akan people of Ghana, Anansi the spider wins all the world's stories from the sky god "
            + "Nyame.",
        "The Epic of Gilgamesh, from ancient Mesopotamia, is one of the oldest stories ever written down, about 4,000 "
            + "years old.",
        "In \"Journey to the West\", a Chinese novel from the 1500s, the Monkey King Sun Wukong can travel 108,000 li "
            + "in one somersault.",
        "The Brothers Grimm, Jacob and Wilhelm, collected German folk tales and printed them from 1812, Cinderella and "
            + "Rapunzel among them.",
        "Hans Christian Andersen, from Denmark, wrote \"The Little Mermaid\" and \"The Ugly Duckling\". A statue of "
            + "the Little Mermaid sits by the sea in Copenhagen.",
        "In Norse myths, Thor's hammer is called Mjölnir, and it always flies back to his hand after he throws it.",
        "In the legend of King Arthur, young Arthur pulls a sword from a stone, which proves he is the true king.",
        "Mary Shelley began \"Frankenstein\" at 18, in 1816, during a ghost-story contest with friends near Lake "
            + "Geneva.",
        "In Jules Verne's \"Twenty Thousand Leagues Under the Sea\", from 1870, Captain Nemo sails a submarine called "
            + "the Nautilus.",
        "In \"Don Quixote\" by Miguel de Cervantes, from 1605, a man who has read too many knight stories attacks "
            + "windmills he thinks are giants.",
        "In \"Treasure Island\" by Robert Louis Stevenson, from 1883, the pirate Long John Silver has a parrot named "
            + "Captain Flint.",
        "The Panchatantra, old animal fables from India, were told to teach three princes how to be wise.",
        "In a Japanese folk tale, Momotaro is born from a giant peach and sets off to fight ogres with a dog, a monkey "
            + "and a pheasant.",
        "In a Korean folk tale, a brother and sister escape a tiger by climbing a rope from the sky, and become the sun "
            + "and the moon.",
        "In a Greek myth, Icarus flies on wings of feathers and wax, goes too close to the sun, and falls into the sea.",
        "In the Greek myth, Pandora opens a jar that lets every trouble out into the world. Only hope stays inside.",
        "Sinbad the Sailor, from \"One Thousand and One Nights\", makes seven voyages, and meets a bird big enough to "
            + "carry off an elephant.",
        "Shakespeare's Globe Theatre in London burned down in 1613, when a cannon fired during a play set its roof on "
            + "fire.",
        "\"Beowulf\", an Old English poem over 1,000 years old, tells of a hero who fights the monster Grendel.",
        "\"The Tale of Genji\", written by Murasaki Shikibu in Japan about 1,000 years ago, is often called the "
            + "world's first novel.",
        "Agatha Christie's play \"The Mousetrap\" has run in London since 1952, longer than any other play.",
        "In the legend of the Trojan Horse, Greek soldiers hide inside a giant wooden horse to get into the city of "
            + "Troy.",
        "Robin Hood is an English legend: an outlaw in Sherwood Forest who robs the rich to help the poor.",
        "The legend of El Dorado, a city of gold somewhere in South America, sent many explorers searching. None found "
            + "it.",
        "In \"The Adventures of Pinocchio\" by Carlo Collodi, from 1883, a wooden puppet's nose grows whenever he "
            + "lies.",
        "J.R.R. Tolkien made up whole languages for his elves, such as Quenya and Sindarin, before he wrote their "
            + "stories.",
        "In \"Gulliver's Travels\" by Jonathan Swift, from 1726, Gulliver visits Lilliput, where the people are about "
            + "15 cm tall.",
        "In \"Rip Van Winkle\" by Washington Irving, from 1819, a man falls asleep in the mountains and wakes 20 years "
            + "later.",
        "\"Moby-Dick\" by Herman Melville, from 1851, begins with the words \"Call me Ishmael.\"",
        "Bram Stoker's \"Dracula\", from 1897, is told through letters, diary pages and newspaper clippings.",
        "\"A Modern Hero's Journey\", a poem by Youngjin that pokes fun at stories that are all alike (<link "
            + "href=\"https://thingspool.net/essays/page-23.html\">read it</link>): an average dragon kidnaps an "
            + "average princess, an average knight slays it, and an average audience says it was good.",
        "Youngjin's introduction to the writings of the game designer Katarina Gyllenbäck (<link "
            + "href=\"https://thingspool.net/read-rec/page-2.html\">read it</link>): a story in a game should neither "
            + "tell nor show, but involve the player, in choices that matter to them.",
        "\"Archetypes of Play\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/concepts-of-plan/page-3.html\">read it</link>): each of us carries a "
            + "museum of small imagined worlds, and two people who read the same fantasy novel share more or less the "
            + "same world.",
        "\"Dead Words\", an essay by Youngjin (<link href=\"https://thingspool.net/concepts-of-plan/page-4.html\">read "
            + "it</link>): words like \"postmodernism\" are dead, since nobody can picture them, while \"dragon\", "
            + "\"fire\", \"sword\" and \"tree\" are alive.",
        "\"AI-Generated Game\", a short essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-9.html\">read it</link>): a game is a web of "
            + "situations joined by choices, while a movie or a novel runs along one straight line.",
        "\"Useless Knowledge?\", a short essay by Youngjin (<link "
            + "href=\"https://thingspool.net/essays/page-3.html\">read it</link>): no knowledge is useless; he imagines "
            + "robots programmed by writing literature, and job ads asking for 10 years of experience in classical "
            + "literature.",
        "\"A Game Developer's Journey\", Youngjin's story in 12 chapters about a made-up game developer (<link "
            + "href=\"https://thingspool.net/gamedev-journey/page-8.html\">read it</link>): in chapter 8, a talking "
            + "square tells him a fantasy world's long history, full of strange names, until he shouts \"That's "
            + "enough!\"",
    ],
    jester: [
        "Wombats make cube-shaped droppings. No other animal is known to do that.",
        "On April 1, 1957, the BBC showed Swiss farmers picking spaghetti from trees. Many viewers called to ask how to "
            + "grow their own.",
        "Every year at Cooper's Hill in England, people chase a wheel of cheese down a very steep hill. The first one "
            + "down wins the cheese.",
        "Sea otters hold hands while they sleep, so that they don't drift apart.",
        "A group of owls is called a parliament.",
        "Pots of honey found in ancient Egyptian tombs were still good to eat. Honey almost never spoils.",
        "The Eiffel Tower grows up to 15 cm taller in summer, because iron expands in the heat.",
        "Bananas are very slightly radioactive, because they contain potassium.",
        "In the film \"Steamboat Bill, Jr.\" from 1928, the front of a house fell on Buster Keaton, and he stood just "
            + "where its open window landed.",
        "Scotland's national animal is the unicorn.",
        "Some penguins give a smooth pebble to the penguin they like.",
        "In the 1830s, ketchup was sold in America as a medicine, in pills.",
        "A lobster's teeth are in its stomach.",
        "Butterflies taste with their feet.",
        "Charles Osborne, an American, had hiccups for 68 years, from 1922 to 1990.",
        "Elephants can't jump.",
        "In 1995, scientists in Japan trained pigeons to tell paintings by Picasso from paintings by Monet.",
        "The Ig Nobel Prizes, given every year since 1991, honor real science that first makes people laugh, and then "
            + "makes them think.",
        "A sloth can hold its breath for up to 40 minutes underwater.",
        "Polar bears have black skin. Their fur only looks white: each hair is see-through.",
        "The dot over a small i or j has a name: it's called a tittle.",
        "Cats can't taste sweet things.",
        "Mr. Potato Head, from 1952, was the first toy ever advertised on TV.",
        "In 1787, Levi Hutchins of New Hampshire made an alarm clock that could only ring at 4 in the morning, the time "
            + "he got up.",
        "Starfish have no brain and no blood.",
        "Koalas sleep up to 20 hours a day, because their eucalyptus leaves give them very little energy.",
        "Goats have rectangular pupils, which let them watch for danger all around.",
        "Hippos can't swim. They walk or bounce along the river bottom instead.",
        "Male seahorses carry the eggs, and give birth to the babies.",
        "The longest flight of a chicken on record lasted 13 seconds.",
        "\"The Island of Infinite Treasures\", Youngjin's satire of greedy games, written as a game's script (<link "
            + "href=\"https://thingspool.net/infinite-treasures/page-4.html\">read it</link>): after the player walks "
            + "for 4 hours, the game rewards him with an achievement: \"You know how to walk!\"",
        "\"Alien Job Interview\", Youngjin's parody of tech job interviews in 10 parts (<link "
            + "href=\"https://thingspool.net/alien-job-interview/page-6.html\">read it</link>): a boss leaves a "
            + "puzzle toy on the floor to see if the candidate solves it unasked, and the candidate puts it in the "
            + "trash can.",
        "\"Sandwich Engineering\", Youngjin's story that teaches logic with sandwiches and pokes fun at tech hype (<link "
            + "href=\"https://thingspool.net/sandwich/page-3.html\">read it</link>): score a sandwich by adding up its "
            + "parts, and one with a hundred slices of cheese wins, though nobody wants to eat it.",
        "\"Sandwich Engineering\", Youngjin's story that teaches logic with sandwiches and pokes fun at tech hype (<link "
            + "href=\"https://thingspool.net/sandwich/page-4.html\">read it</link>): two slices of bread with nothing "
            + "between them make an \"empty sandwich\", and a slice of bread between two more makes a \"bread "
            + "sandwich\".",
        "\"A Layman's Bridge to Mathematics\", Youngjin's series linking math to everyday life (<link "
            + "href=\"https://thingspool.net/bridge-to-math/page-4.html\">read it</link>): which is greater, the heat "
            + "of a microwaved cheeseburger or the sweetness of a chocolate mousse cake? Nobody can say, so each needs "
            + "a scale of its own.",
        "\"ChatGPT Can't Replace Me\", Youngjin's fake social media post (<link "
            + "href=\"https://thingspool.net/infsoc/page-4.html\">read it</link>): a salesman says no chatbot could "
            + "copy his \"absolutely original\" writing, and proves it with three long sentences of empty business "
            + "words.",
        "\"Universal Laws of Game Design\", Youngjin's series in 15 volumes (<link "
            + "href=\"https://thingspool.net/game-design/page-13.html\">read it</link>): he imagines a video game for "
            + "a cow, with a screen to watch, a sensor to lick and a snack as the prize, all to get more milk.",
        "\"Game Design Concepts\", ten short ideas by Youngjin (<link "
            + "href=\"https://thingspool.net/morsels/page-1.html\">read it</link>): he maps a character's mood on three "
            + "scales, and calls low happiness and excitement with high confidence \"the mood of Squidward\", the "
            + "grumpy squid from SpongeBob.",
        "\"Millimeter Real Estate\", an essay by Youngjin (<link href=\"https://thingspool.net/essays/page-7.html\">read "
            + "it</link>): he imagines land sold by the square millimeter, as easily as swiping a credit card, so that "
            + "owners draw their land a tiny piece at a time.",
        "\"Technical Memes\", Youngjin's joke charts (<link href=\"https://thingspool.net/concepts-of-plan/page-2.html\">"
            + "read it</link>): game development as a cycle: a new idea, a quick prototype, a cleanup, doubts, a lesson, "
            + "and a new idea again.",
    ],
    sage: [
        "The Chinese thinker Zhuangzi dreamed he was a butterfly. Awake, he wondered if he was now a butterfly dreaming "
            + "of being Zhuangzi.",
        "Zeno of Elea argued that to cross a room you must first cross half of it, then half of what is left, forever. "
            + "Yet people cross rooms every day.",
        "The ship of Theseus: if every plank of a ship is replaced, one by one, is it still the same ship? Plutarch "
            + "wrote of it nearly 2,000 years ago.",
        "Heraclitus, a Greek thinker, said you cannot step into the same river twice.",
        "Epictetus, a Stoic teacher who began life as a slave, taught that some things are up to us and some are not, "
            + "and to worry only about the first.",
        "Seneca, a Roman Stoic, wrote that we suffer more often in imagination than in reality.",
        "The \"Tao Te Ching\", said to be by Laozi, says that a journey of a thousand miles begins with a single step.",
        "Around the year 1015, Ibn al-Haytham showed that we see because light comes into our eyes, not because our "
            + "eyes send out rays.",
        "Hypatia of Alexandria taught mathematics, astronomy and philosophy around the year 400.",
        "In 1610, Galileo saw four moons going around Jupiter through his telescope, so not everything circles the "
            + "Earth.",
        "Johannes Kepler found in 1609 that planets move around the Sun in ovals, called ellipses, not perfect circles.",
        "Isaac Newton himself told the story of a falling apple that set him thinking about gravity.",
        "Charles Darwin waited about 20 years before he published \"On the Origin of Species\" in 1859.",
        "Marie Curie was the first person to win Nobel Prizes in two different sciences: physics in 1903 and chemistry "
            + "in 1911.",
        "In 1905, while working at a patent office in Bern, Albert Einstein published four papers that changed physics.",
        "Erwin Schrödinger imagined a cat in a box, alive and dead at once until someone looks, to show how strange "
            + "quantum physics is.",
        "Michel de Montaigne gave the essay its name in 1580: \"essai\" means \"attempt\" in French.",
        "Baruch Spinoza earned his living grinding glass lenses while he wrote his philosophy.",
        "Aristotle was the teacher of Alexander the Great when Alexander was a boy.",
        "Carl Sagan liked to say we are made of star stuff: the atoms in our bodies were made inside stars long ago.",
        "Bertrand Russell's barber puzzle: a barber shaves everyone who doesn't shave himself. So who shaves the "
            + "barber?",
        "Ludwig Wittgenstein wrote that the limits of his language meant the limits of his world.",
        "In 1931, Kurt Gödel proved that in any rich enough system of mathematics, some true statements can never be "
            + "proved.",
        "Around 240 BC, Eratosthenes worked out the size of the Earth from the Sun's shadows in two Egyptian cities.",
        "Occam's razor, named after William of Ockham: when two explanations fit, the simpler one is usually better.",
        "In 1950, Enrico Fermi asked at lunch: if the universe is so big and old, where is everybody? People still ask "
            + "it.",
        "Buridan's donkey stands exactly between two equal piles of hay, can't choose, and goes hungry. Philosophers "
            + "use it to talk about choice.",
        "In the 1960s, Edward Lorenz found that a tiny change in weather data could lead to a completely different "
            + "forecast: the butterfly effect.",
        "The Andromeda Galaxy, about 2.5 million light-years away, is the farthest thing most people can see with their "
            + "eyes alone.",
        "A day on Mars, called a sol, is about 24 hours and 40 minutes long.",
        "\"Elements of an Indie Game\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-22.html\">read it</link>): a spring pushes back "
            + "when squeezed, as if it wanted balance, so how can we be sure a person is more than a very complicated "
            + "spring?",
        "\"Feeble Attempt\", a short essay by Youngjin (<link href=\"https://thingspool.net/essays/page-16.html\">read "
            + "it</link>): some once said guns would never replace bows, since loading took a minute; some said AI "
            + "would never replace people, since it failed trick questions.",
        "\"The Origin of Reality\", Youngjin's series in 18 volumes (<link "
            + "href=\"https://thingspool.net/reality/page-6.html\">read it</link>): a black dog, a white dog, a black "
            + "cat and a white cat can be grouped by animal or by color, and both ways are right.",
        "Youngjin's introduction to the books of Bertrand Russell (<link "
            + "href=\"https://thingspool.net/read-rec/page-4.html\">read it</link>): he calls \"The Problems of "
            + "Philosophy\" perhaps the best first book on philosophy; it asks whether matter comes from mind, or "
            + "mind from matter.",
        "\"Sandwich Engineering\", Youngjin's story that teaches logic with sandwiches and pokes fun at tech hype (<link "
            + "href=\"https://thingspool.net/sandwich/page-2.html\">read it</link>): an \"everything sandwich\" has "
            + "the whole universe inside it, while an \"anything sandwich\" may hold anything at all.",
        "\"Usefulness\", a short essay by Youngjin (<link href=\"https://thingspool.net/essays/page-2.html\">read "
            + "it</link>): math textbooks covered in roller coasters and robots, to prove math is useful, hide what is "
            + "beautiful about it.",
        "\"Artificial Emotion\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-15.html\">read it</link>): AI solves the "
            + "problems it is given; he says emotions are what would make it look for problems of its own.",
    ],
    caretaker: [
        "Kintsugi is the Japanese way of mending broken pottery with lacquer and gold, so that the repair shows "
            + "instead of hiding.",
        "In London, some gas street lamps are still lit and looked after by hand.",
        "People in ancient Babylon made soap from fats and wood ash about 4,800 years ago.",
        "In Japan, many families clean the whole house at the end of each year, before the New Year. It's called "
            + "ōsōji.",
        "Big Ben is the name of the great bell in London's clock tower, not of the clock or the tower.",
        "The Swiss Army knife was first made in 1891, for soldiers of the Swiss army.",
        "A honeybee makes only about a twelfth of a teaspoon of honey in its whole life.",
        "Sailors use the bowline knot because it makes a loop that won't slip, yet is easy to untie.",
        "The oldest stone tools ever found, in Kenya, are about 3.3 million years old.",
        "Duct tape was first made during World War II, to keep water out of ammunition boxes.",
        "WD-40's name means \"Water Displacement, 40th formula\": its makers got it right on the 40th try.",
        "In most Japanese schools, students clean their own classrooms every day.",
        "The first mechanical clocks in Europe, around 1300, had no minute hand.",
        "People in China used wheelbarrows about 1,800 years ago, long before Europe had them.",
        "About a quarter of the Netherlands lies below sea level, kept dry by dikes and pumps.",
        "An aluminum can can be recycled again and again, and be back on a shop shelf in about 60 days.",
        "Stainless steel doesn't rust easily because it contains chromium.",
        "William Addis made the first toothbrushes sold in large numbers, in England, around 1780.",
        "Rome's great sewer, the Cloaca Maxima, was built about 2,500 years ago, and part of it still works.",
        "In 1847, Ignaz Semmelweis showed that when doctors washed their hands, far more of their patients lived.",
        "Florence Nightingale, a nurse, drew charts in the 1850s that showed clean hospitals save lives.",
        "Francesco Cirillo named his \"Pomodoro\" way of working, 25 minutes on and 5 off, after his tomato-shaped "
            + "kitchen timer.",
        "Sourdough bread rises with wild yeast. People baked leavened bread in ancient Egypt.",
        "Some bonsai trees, kept small by careful trimming, are hundreds of years old.",
        "Wooden ships were kept watertight with tar and old rope fibers, called oakum, pressed between the planks.",
        "A well-kept cast-iron pan can last a hundred years or more.",
        "\"Nature of Software Engineering\", a short essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-18.html\">read it</link>): people notice the "
            + "features they can see, so it takes courage for an engineer to fix the small details nobody may notice.",
        "\"Universal Laws of Game Design\", Youngjin's series in 15 volumes (<link "
            + "href=\"https://thingspool.net/game-design/page-12.html\">read it</link>): dogs play-wrestle, though it "
            + "brings them no food or shelter; pretend challenges may train the body and mind for real ones.",
        "\"Future of Game Development - 2\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-13.html\">read it</link>): should truck "
            + "drivers quit once cars drive themselves? He says a new job should still use much of what you already "
            + "know.",
        "\"Caffeine, Sugar, and Fasting\", an essay by Youngjin on his own habits (<link "
            + "href=\"https://thingspool.net/concepts-of-plan/page-5.html\">read it</link>): it took him about a week "
            + "to get used to mornings without coffee, and 3 or 4 weeks to skip breakfast comfortably.",
        "\"A Tribute to Signal Studios\", Youngjin's memoir of his first job (<link "
            + "href=\"https://thingspool.net/essays/page-15.html\">read it</link>): he says the studio paid him for "
            + "every extra hour he worked on weekends, and gave him a raise he never asked for.",
        "\"On Purity of Knowledge\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-1.html\">read it</link>): he pictures the year "
            + "2050, when the game engine of his early years is long gone, so he studies the basics that last.",
        "\"Designing a Software Product\", an essay by Youngjin on a pet game like the Tamagotchi (<link "
            + "href=\"https://thingspool.net/concepts-of-plan/page-1.html\">read it</link>): you decide which pets "
            + "share a room, since jealous pets might fight.",
        "\"Surviving the Reign of AI\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/essays/page-19.html\">read it</link>): the best sandwich maker in a village "
            + "of ten thousand, cut off from the world, never lacks customers; once the village trades with the world, "
            + "he competes with billions.",
    ],
    curator: [
        "Hokusai's woodblock print \"The Great Wave off Kanagawa\", from about 1831, shows Mount Fuji small behind a "
            + "giant wave.",
        "The blue paint ultramarine was made from lapis lazuli, a stone mined in Afghanistan, and once cost more than "
            + "gold.",
        "Tyrian purple dye came from sea snails. It took thousands of snails to dye one robe, so only the very rich "
            + "wore purple.",
        "The paint color Prussian blue was found by accident, in Berlin, in the early 1700s.",
        "Frida Kahlo painted many self-portraits. She said she painted herself because she was so often alone.",
        "Georges Seurat painted \"A Sunday Afternoon on the Island of La Grande Jatte\", in the 1880s, out of tiny "
            + "dots of color.",
        "The Terracotta Army in China is about 8,000 clay soldiers, made over 2,200 years ago, and no two faces are "
            + "quite the same.",
        "In 2018, Banksy's painting \"Girl with Balloon\" partly shredded itself right after it was sold at an auction "
            + "in London.",
        "Michelangelo carved his statue of David, over 5 meters tall, from a block of marble other sculptors had left "
            + "unused.",
        "The Venus de Milo, a Greek statue without arms, was found on the island of Milos in 1820.",
        "Gustav Klimt's painting \"The Kiss\", from 1907 to 1908, has real gold leaf in it.",
        "Pablo Picasso's full name is about 20 words long.",
        "Jackson Pollock made paintings by dripping and pouring paint onto canvases laid flat on the floor.",
        "When Henri Matisse could no longer stand to paint, he made art by cutting shapes out of painted paper.",
        "Vincent van Gogh collected Japanese woodblock prints, and painted copies of some of them.",
        "The Bauhaus, an art school in Germany from 1919 to 1933, taught that useful things can be beautiful.",
        "Isaac Newton split white light into a rainbow with a glass prism, and named seven colors in it.",
        "The cave paintings at Altamira, in Spain, show bison painted more than 14,000 years ago.",
        "The glass pyramid at the Louvre, by the architect I. M. Pei, opened in 1989.",
        "Yayoi Kusama's \"Infinity Mirror Rooms\" use mirrors and small lights to look as if they go on forever.",
        "Gold can be hammered into leaf so thin that light shines through it.",
        "In \"The Arnolfini Portrait\", from 1434, Jan van Eyck painted a tiny round mirror showing the room from "
            + "behind, and wrote on the wall \"Jan van Eyck was here\".",
        "Hokusai's series \"Thirty-six Views of Mount Fuji\" actually has 46 prints: ten were added later.",
        "In 1926, US customs taxed Constantin Brâncuși's sculpture \"Bird in Space\" as plain metal. A court later "
            + "ruled it was art.",
        "Diego Velázquez painted himself at work, brush in hand, inside his painting \"Las Meninas\", from 1656.",
        "Claude Monet painted about 250 pictures of the water lilies in his garden at Giverny.",
        "Johannes Vermeer may have made only about 35 paintings in his whole life.",
        "\"Elements of an Indie Game\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-22.html\">read it</link>): the red, green and "
            + "blue of screens can't show every color the eye can see, yet everyone uses them because they cover "
            + "enough.",
        "\"Response to 'Photography is the Future'\", Youngjin's fake social media post (<link "
            + "href=\"https://thingspool.net/infsoc/page-2.html\">read it</link>): an art professor in 1838 says "
            + "cameras will never replace painters, since a photo takes an hour and a painter minutes. \"Checkmate!\"",
        "\"The Origin of Reality\", Youngjin's series in 18 volumes (<link "
            + "href=\"https://thingspool.net/reality/page-18.html\">read it</link>): black and white paint on one spot "
            + "mix into gray, but spread over different spots they make a picture.",
        "\"To Every Lonely Artist\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/concepts-of-plan/page-6.html\">read it</link>): casual arcade games are "
            + "easy to enjoy but shallow, soap operas are full of feeling but light on thought, and plain geometric "
            + "art is all thought.",
        "\"Alien Job Interview\", Youngjin's parody of tech job interviews in 10 parts (<link "
            + "href=\"https://thingspool.net/alien-job-interview/page-9.html\">read it</link>): a boss asks what the "
            + "most creative color is; the candidate says green, and is told a creative person would say magenta.",
        "\"A Game Developer's Journey\", Youngjin's story in 12 chapters about a made-up game developer (<link "
            + "href=\"https://thingspool.net/gamedev-journey/page-11.html\">read it</link>): in chapter 11, a Museum "
            + "of Everything holds every possible painting and book, yet people love what is familiar.",
        "\"Mathematical Interpretation of Hume's Philosophy\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/morsels/page-3.html\">read it</link>): the word \"fire\" points to fire by "
            + "standing next to a picture of it, while a fire icon on a plane's safety card points by looking like it.",
        "\"Automation of Arts - 3\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/essays/page-11.html\">read it</link>): with more free time, thanks to "
            + "machines, he expects people to want things with a human touch, which helps artists.",
        "\"Degrees of Abstraction in Games\", an essay by Youngjin (<link "
            + "href=\"https://thingspool.net/software-development/page-8.html\">read it</link>): game art people "
            + "already know explains itself: a pirate with a sword is plainly an enemy, but a purple circle pointing a "
            + "triangle is not.",
    ],
};
