# Pets

Reference: @src/shared/object/types/objectTypeConfig/petObjectTypeConfig.ts , @src/shared/object/types/objectTypeConfig/serverPetObjectTypeConfig.ts , @src/shared/object/types/objectTypeConfig/petScrapObjectTypeConfig.ts , @src/shared/object/util/petBehaviorUtil.ts , @src/shared/object/util/petRecordUtil.ts , @src/shared/object/util/petIdentityUtil.ts , @src/shared/object/util/petShownStateUtil.ts , @src/shared/object/util/petPathSyncUtil.ts , @src/shared/object/util/petEntranceUtil.ts , @src/shared/object/util/petInjectionUtil.ts , @src/shared/object/util/petSaleUtil.ts , @src/shared/object/util/petAffinityUtil.ts , @src/shared/object/util/petListenerUtil.ts , @src/shared/object/maps/petLineMap.ts , @src/server/agent/data/petReadingLines.ts , @src/server/agent/data/petLines.ts , @src/shared/graphics/mesh/composition/util/petCompositionUtil.ts , @src/server/object/util/petServerUtil.ts , @src/server/object/util/petPlayUtil.ts , @src/server/object/util/petPathServerUtil.ts , @src/server/agent/util/petChatUtil.ts , @src/server/db/util/dbPetUtil.ts , @src/server/db/util/dbUserWriteQueueUtil.ts , @src/client/object/util/petDriverUtil.ts , @src/client/object/types/gameObject/petGameObject.ts , @src/client/object/components/helpers/pet/petNamePlate.ts , @src/client/graphics/util/playModeSelectionUtil.ts , @src/client/ui/components/hud/selection/petEditOptions.tsx , @src/client/ui/components/form/generatePetForm.tsx

A small robot a user buys, names and gives a nature, which then lives a life of its own beside them: it wanders, talks, sleeps, takes fright, fights, runs down, and in the end dies.

## Three object types
| Type | What | Kept by | Played by |
|---|---|---|---|
| `Pet` | A user's own, which follows them from room to room | their record (below) | their browser; the server for an agent |
| `ServerPet` | An admin's: it stays with the room it was generated in, at a health and a charge that never change | the room's saves | the server, while anyone is there |
| `PetScrap` | What is left of a pet that died, where it stood | the room's saves | nobody |

- A `Pet`'s object is in a room only while its owner is, always under the same id.
- Every admin's pet is a `ServerPet`, and nobody else's is. Its identity says which health and which charge it is kept at, so nothing goes into one.
- Scrap is an attached object on a floor, solid to a cannon ball. Anyone moves it; its pet's owner (its source user, kept with the room) or an admin removes it, and only they are shown the tool.
- Each type has a category of its own, with a cap per room, and a user owns only so many pets.

## Who a pet is, and how it is
- **Identity** (`PetIdentity`, set as it is generated and never after): its name, five traits its user sets at one of three levels (dependence, sociability, aggressiveness, bravery, curiosity), a zodiac sign drawn for it and shown to nobody, and a fixed health and charge for one a room keeps.
- **Needs** (`PetNeeds`): health, energy, anger, horror and fatigue. They change only while the pet is played, so only while its owner is in a room.
  - Health and energy run down with time. Another pet's attack takes health fast, and a cannon ball's blast a lump of it. At none, it dies.
  - Out of energy it stands still, does nothing and hears nothing, until someone charges it. Physics still moves it.
  - Anger, horror and fatigue rise with what happens to it and what it is like, and fall off again.
- **What it shows** (`PetState` metadata, see `PetShownStateUtil`): what it is doing, its face, its battery indicator's lit cells, its rust, and what its action is about. It is all a browser draws from and all another pet notices. Only whoever plays the pet writes it, and the server as something is put into it.
- **How two pets get on** is fixed by who they are (`PetAffinityUtil`): signs first, then traits, then some luck of the pair. It is not mutual.

## Behavior
`PetBehaviorUtil` is the one description of a pet's life, run by whoever plays it. It does one thing at a time, and the more pressing takes over:

panic > attack > flight > going to whoever said its name (in a line another answers) > a talk with someone who spoke to it > getting out of a fan's wind that holds it up (staying with whoever called it gives way to that) > sleep > idle doings (a word on what someone built, a chat with another pet, a hug, a word to someone near, a word on something placed, a wander).

- **Told from outside**: a blast, a push, a fright nearby, an edit near it, a line someone said, someone speaking to it and what it answers, what was put into it, and being held still for a while.
- **It reacts a moment late**: what a thing does to it (harm, a charge) happens at once; what it does about it follows after a short wait, shorter for what startles it.
- **A fright fades with distance**: nearly in full a good way off, then less and less, and none past `PET_FRIGHT_RADIUS`.
- **A fan's wind holding it up** (blowing up from under it) doesn't keep it there: its ways start from where it would come down, so whatever it is at goes on; and standing in it for anything but an answer it owes someone, it steps out as it faces, without turning, to the nearest place no wind lifts it at, and nothing of its own accord stops it on the way (`PhysicsManager.getPush`, whence `PetSurroundings.roomID`).
- **Idle doings keep apart**: after one, it begins none of its own accord for a while. Answering another pet, or a person, is not of its own accord.
- **It turns before it goes**: facing too far off its way, it stands and turns to it first, slower at its ease than in a fight or a fright. With a word for someone or something, it stays turned to them wherever they go; and standing idle while its words to someone are still up, it stays turned to them still, and strolls off only once those words are gone (`PetBehavior.addressee`).
- **Chatting pets keep apart**: one too near the other backs off from it, facing it still, where it has the floor to; and none stops for a rest right beside another.
- **Someone it goes up to** (to hug them, or at their call) it stops a little way off (`PET_APPROACH_DISTANCE`): no nearer than lets their first-person view, looking level, show its head and eyes over the chat bar, and all of its words. Staying by them, it keeps that far, after them as they go and backing off from them as they come, facing them still.
- **Its owner counts for more**: it wanders within a leash of them by its dependence, across the floor plan on whichever floor, follows them to their floor when it strays, and has more words for them and for what they build than for anyone else's. Dying, any pet keeps a short leash of them, or of what they look at while they edit (their camera's pivot, `PetSurroundings.ownerFocus`), so that they see it ask for a wrench.
- **Where it wanders**: now and then up or down a stair, where it can, the oftener the more curious it is; and on a floor, a nearer place the likelier, and an odder one (high up, by a drop, walled in, by a fan, or far from the last few places it went to) the likelier the more curious it is, the less likely the less.
- **A word on what was built** it says right in front of it, as whoever built it sees it (their own browser's camera, else their player): it goes there first, turns to it, and then says it.
- **Its words stay up** a good while after they are read, as long as a player's message at least, unless it says something else; what it does is paced by how long they take to read. **Its face** keeps the mood of what it said or did a while after it is done, unless something else changes it. **Asleep**, its eyes are shut, however cross it is.
- **Called by name**, letter case aside, in a player's line that someone else answers (a helper named in it, or another pet named first), it goes to them and stays a moment. A line that is for it, it answers instead (see below), never going to them as well, whichever of the two its player is told first.
- **Lines** are fixed words (`PetLineMap`), with a mood each, and two for its needs, which picture the control that answers them (see [chat.md](chat.md)). A line is picked from a pool, none said again soon after, and given an interjection before it now and then. None spells out a robot's sound: its voice makes those as it says the line (see [audio.md](../audio/audio.md)). Now and then a chat, a word to someone or a word on a canvas, a door or a sign speaks of one of Youngjin's newer writings, with a link to it (`petReadingLines.ts`, kept current by the `gameplay-ai` skill).
- **What pets chat in** (chats, words on things, on edits and to people; `PET_LINES`) is the server's, and reaches a browser as an asset it fetches once the game has loaded (`PetLinesBuilder`, `PetLineLoadUtil`), not in the client's bundle; until it comes, a pet only reacts. A chat is told to the room by its place among them, so browsers chat in step only on the same build's lines.
- **Paths** are planned over the voxel grid as a walker lower than a player that climbs two blocks at a step (`VoxelWalker`), which its collider also climbs (see [physics.md](../geometry/physics.md)). It sets off on one from where it stands, straight for the farthest point of it that it can walk straight to, never back to the grid's point nearest it first: as slowly as it turns, that would turn its back on where it is going. Going up to someone, it heads straight at where they are now wherever it can walk straight there.
- **A charge** stops a little short of where two bodies would touch face to face, and half-way to a pet that charges back: bodies only push one another softly, so a pet that ran on would pass through its victim between two beats, and two a little askew would overlap at their corners.

## Who plays one, and what the room hears
- **A browser plays its user's pets** (`PetDriverUtil`): it brings them in after the user, steers each by physics every frame, gives each a beat of its life a few times a second, and tells the server. It plays one only once it is spawned, which is when the server is told of it: the server takes nothing about a pet it doesn't know.
- **The server plays the rest** (`PetPlayUtil`, from the socket flush): `ServerPet`s, and agents' pets, whom it also brings in.
- **Entrance** (`PetEntranceUtil`): one at a time, each once the spot in front of the door its owner came by is clear of bodies, and nobody is still behind the door. It is put behind the door, in the wall, and walks out of it as its owner did, doing nothing else until it is out; after a wait it comes whoever is in the way, and on to somewhere beside the spot if that is still taken, the farther off the longer it has waited. Where its owner came by no door, it is put down where it is bound.
- **Movement is told as a way, not at every step** (`SetObjectPathSignal`, both directions): whoever plays the pet sends the waypoints it sets off on and how fast (`PetPathSyncUtil`). Every other browser, and the server for a browser's pet (`PetPathServerUtil`), plays the way out the same.
  - A way is told a stretch at a time, as far as the next corner the pet stands and turns at, where the room has it stand until it is told the next. What it shows says which way it turns meanwhile.
  - **Off its way** (a push, a fall, a fan's wind), it is told as where its body has been: a few points to each beat, each reached in the time the body took, which the room plays a beat behind. Nothing brings a pet anywhere at a rush, and no pet has a transform receiver: what a browser shows of someone else's pet is only ever a way played out.
  - A place it is carried to turns it nowhere: it turns toward the next it goes to by itself.
- **A way is played by the clock**, not by frames: a slow browser's frames are cut short, so one that follows a pet advances it by the time really passed, and one that plays a pet steps its body through the time its frames left out.
- **What it shows and says** go out as its metadata, when they change.
- **How its pets are** goes out as a report on the user's player now and then, and before the user leaves a room, sells one, or one dies.
- A browser's word of its pets is paid from a budget of its own, apart from edits (see `USER_BUDGETS`).
- A newcomer to a room is told the rest of each way under play.

## Talking with people
- **A line is for one listener**, a helper or a pet (`HelperBehaviorUtil`, `PetListenerUtil`): the one it names, a helper before a pet; else, of the helpers and pets that hear it, the one the speaker faces. The browser picks by the same rule, to show a helper thinking at once.
- **A pet hears** whoever speaks near it on its floor, anyone's pet and anyone speaking. Asleep, in a fight or in a fright it hears only its name, which wakes it if asleep; dead or out of battery, nothing. No pet hears a line late, as a helper does.
- **The server** (`PetChatUtil`) tells whoever plays the pet that it was spoken to, and, once the speaker has paused, what it answers: `PetPlayUtil` for a pet it plays itself, else the owner's browser alone (`PetChatSignal`).
- **The pet** turns to the speaker where it stands a moment later and waits, says its answer once it has one, and stays turned to them a while; a talk begun by its name from farther off than talks usually hold doesn't break on distance (`PetBehavior.chatReach`). Meanwhile the room sees it thinking (typing dots by its name), as a helper is: shown by the server and never kept, and at once in the speaker's own browser (`HelperThinkingUtil`). It answers what was said as a bright little robot would, declining only what is long or hard, or how the game works.
- **The answer is Claude's**, asked for as a helper's is: the same model, daily budget and hourly limit per speaker (see [agents.md](../networking/agents.md)). The pet is told how to talk, its traits in words, a quirk of its own, how it is now, and whether its human or someone else speaks; never its sign, nor a speaker's name, and its human's only as a talk opens, since a model says a name it is told in every line. It writes one short line, led by a sign for the face it says it with, which is kept to plain text a bubble holds: nothing in it becomes a link or a picture, and a robot's sound it spells out at the start, at the end or as a sentence of its own is taken out.
- **With no answer to be had** (no key, the budget or the hour spent, a failure), it answers in a fixed word or two.

## Owning one
- **The record** is the user's player's `Pets` metadata, and so part of what their row keeps of their player between visits (see [user_state_management.md](../networking/user_state_management.md)): each pet's id, needs and identity.
  - Which pets it lists is the server's alone to change. A user sets only a report of needs, which is merged into the pets already listed (`PetRecordUtil`).
- **Buying**: adding a `Pet` the record doesn't list is generating one, somewhere clear to stand. The server takes its price, lists it, and writes the record and the dollars to the row in one transaction, in turn with the user's other writes (`DBPetUtil`, `DBUserWriteQueueUtil`). A pet coming in after its owner is listed already, costs nothing, and is added wherever whoever plays it has it.
- **Selling** is its owner removing it, paid by the health it is in, in a few steps (`PetSaleUtil`). No undo brings it back, nor adds one again (see [game_mode.md](game_mode.md)).
- **Dying**: the server shows it dead, leaves scrap on the nearest floor that takes it, removes it and unlists it.
- **Injecting** (`InjectPetSignal`): anyone in the room puts a battery into a pet whose charge can change, or a wrench into one whose health can, for dollars. The server judges by what the pet shows, takes the price, sets what it shows at once, and tells the room; whoever plays the pet then charges or mends it.
- **Never emptied by a failed read**: a row that couldn't be read is not an empty one. A player that arrived without its metadata is never saved over the row, and can adopt no pet.

## Cannons
A cannon aims only at players, and fires at one with a pet in the way, which its ball then strikes. A blast throws a pet, costs it health and frightens every pet near (see [cannon.md](cannon.md)).

## In a browser
- **Parts** (`PetCompositionUtil`): a tin body in two halves on four wheels, a screen for a face, a battery indicator on either side, and a label of a dull yellow front and back, under the box its name is printed in, which never rusts.
  - Rust is a per-instance attribute of the tin material, and the face and the indicator are drawn by the emissive material from a few numbers per instance, dimming with distance (see [materials_and_shaders.md](../graphics/materials_and_shaders.md)).
  - Rust shows its health in equal steps, one for each share of it lost in full (`PetShownStateUtil`), and a room's pet is kept at the top of a step, so it looks as one run down to it does. Each step rusts that share of its body, all of it only as scrap, at a tin's age measured from the tin's own noise by `dev/scripts/graphics/measurePetRust.js`: the tin's scale itself rusts little of it until well past its middle. Run it again after changing the tin's rust, the steps or a pet's parts, and copy the ages it prints into `PetCompositionUtil`.
  - Its model, a barcode and its name are printed on the front and the back of its base, and a word over each indicator (`PetNamePlate`): one mesh and one coverage atlas for every pet in the room, each print in its own ink.
  - The prints are placed whenever `InstancedMeshComposer` places the body's instances, from the same matrices: placed on their own, they part from a moving or hopping body by a frame.
- **Selecting**: anyone selects a user's pet, and only an admin a room's, in edit mode or by a click in play mode (`PlayModeSelectionUtil`), and it is outlined as a box about its body. In play mode a click on it again lets it go, and as a selection there ends, the gaze the click turned goes back to rest. A pet asking for a battery or a wrench is selected by a click on its words, in either mode. Its tools (`PetEditOptions`) are the injections it can take, each with its price, and for its owner the removal, with what it sells for.
- **Generating** (`GeneratePetForm`): a popup raised from the face tools takes its name, its color (from its own palette, `PET_COLOR_PALETTE_NAME`, white first) and traits, and for an admin the health and the charge it is kept at.
- **Its color** paints its body alone, never its face, wheels or labels, and is part of who it is (`PetIdentity.colorIndex`). Each plate prints in two parts from one drawing, parted in a blank band: its model and barcode in an ink that shows on the body (light on a dark one), its name in the label's ink.
- **A guest's new pet** asks them to sign in, in its own bubble, which only they see, and stands still meanwhile.
- A pet's name shows without the "(AI)" a helper's has (see [agents.md](../networking/agents.md)): the model printed on its body, `PET_MODEL_NAME`, says an AI plays it instead, and asked whether it is real, it says so too.
- Effects and sounds: see [particles.md](../graphics/particles.md) and [audio.md](../audio/audio.md), which has its voice: its lines said aloud, and its feelings with no words for them.
- **Trying it**: on a dev server, the `pets` debug command puts the user's own pets in a given health, charge, anger, horror and fatigue at once (`DebugCommandUtil`). On any server, `petscale NAME P` draws the pets of a name P percent as wide from side to side, in this browser until it reloads (`petDrawnWidthsObservable`): on a node of the pet's own above the one its hops move, its collider and outline left as they are. `dev/scripts/helper/samplePetReplies.js` asks the real model for the answers of a few pets of different natures and states.

## Agents and helpers
Agents generate, inject and sell through the same signals, and see pets and scrap in what they look at (see [agents.md](../networking/agents.md)). A pet answers an agent as it does a person: the agent is told which helper or pet heard its line, and pets' words reach it as speech. Helpers are told of pets in outline only.

## Traps
- A browser's copy of the record lags a round trip: a pet its user has just sold or undone must not be brought in again from it, or it would be bought anew.
- The socket layer and the pet driver sit under `GameObject` in the import graph. Neither may import the object factory.
- Pooled instances keep the rust and glyph of whatever held them last, so the composer writes both for every part.
