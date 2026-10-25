import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import NpcGameObject from "../../object/types/gameObject/npcGameObject";
import HelperAPIClient from "../../networking/client/helperAPIClient";
import FTUEUtil from "../../ui/util/ftueUtil";
import { roomChangedObservable, singlePlayerChatLineObservable,
    updateObservable } from "../../system/clientObservables";
import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import HelperSurroundings from "../../../shared/object/types/helperSurroundings";
import HelperBehaviorUtil, { ANSWER_PAUSE_MS } from "../../../shared/object/util/helperBehaviorUtil";
import NpcFacingUtil from "../../../shared/object/util/npcFacingUtil";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../../shared/system/sharedConstants";
import { FTUEElementCodeEnumMap } from "../../../shared/user/types/ftueElementCode";
import SinglePlayerHelper from "../types/singlePlayerHelper";

// The NPCs of a single-player room played as helpers, by the browser, as the room is the browser's alone (see
// HelperBehaviorUtil). Each greets the user once as they come near (telling them how to walk and build, if nothing has
// yet), answers what they say to it through the server (see HelperAPIClient), walks, wanders and turns as a helper in a
// multiplayer room does, an admin holding it still as there, and chats with another helper near it in words the server
// gives. Only in a mode that plays NPCs (see NpcGameObject.arePlayedHere), and only NPCs whose personality is played.

// As often as the server steps its helpers (see SocketsServer's flush), and gives each a beat.
const STEP_SECONDS = SIGNAL_BATCH_SEND_INTERVAL / 1000;
const BEAT_SECONDS = 1;
// What it is asked to answer: the user's latest lines, as many as an ask takes (see HelperRouter).
const MAX_LINES_ASKED = 4;
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};

// By object id.
const helpers = new Map<string, SinglePlayerHelper>();
// askingSmallTalk: whether the words for a chat are on their way, so that no other is asked for meanwhile.
const state = {sinceStep: 0, sinceBeat: 0, askingSmallTalk: false};

updateObservable.addListener("singlePlayerHelperUtil", (deltaTime: number) => {
    const room = App.getCurrentRoom();
    if (room == undefined || room.roomType != RoomTypeEnumMap.SinglePlayer || !NpcGameObject.arePlayedHere())
    {
        helpers.clear();
        return;
    }
    const now = Date.now();
    state.sinceBeat += deltaTime;
    if (state.sinceBeat >= BEAT_SECONDS)
    {
        state.sinceBeat = 0;
        beat(room, now);
    }
    state.sinceStep += deltaTime;
    if (state.sinceStep >= STEP_SECONDS)
    {
        for (const helper of helpers.values())
        {
            const surroundings = surroundingsOf(helper, room);
            followHold(helper, room, surroundings, now);
            HelperBehaviorUtil.act(helper, surroundings, state.sinceStep, now);
        }
        state.sinceStep = 0;
    }
});

roomChangedObservable.addListener("singlePlayerHelperUtil", () => {
    helpers.clear();
});

// A line the user said, for whichever helper it is for (see HelperBehaviorUtil.pickListener).
singlePlayerChatLineObservable.addListener("singlePlayerHelperUtil", (text: string) => {
    const user = App.getUser();
    const room = App.getCurrentRoom();
    const me = getMyPosition();
    const helper = (me == undefined) ? undefined : HelperBehaviorUtil.pickListener([...helpers.values()], text, me);
    if (helper == undefined || user == undefined || room == undefined || text.trim().length == 0)
        return;
    const now = Date.now();
    helper.lines.push(text.trim());
    helper.linesAt = now;
    HelperBehaviorUtil.hear(helper, surroundingsOf(helper, room), user.id, now);
});

// Each second: the helpers there are now, each greeting the user once they come near, and answering them once they
// have paused, and those near each other chatting now and then, before each one's own beat.
function beat(room: Room, now: number): void
{
    findHelpers(room, now);
    const user = App.getUser();
    const me = getMyPosition();
    for (const helper of helpers.values())
    {
        if (user != undefined && me != undefined && !helper.greeted && HelperBehaviorUtil.isInEarshot(helper, me))
        {
            helper.greeted = true;
            HelperBehaviorUtil.say(helper, HelperBehaviorUtil.getGreeting(helper, [user.userName], false), [user.id], now);
            if (!FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.Basics))
            {
                HelperBehaviorUtil.say(helper, HelperBehaviorUtil.getBasics(helper), [user.id], now);
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.Basics);
            }
        }
        answer(helper, room, now);
    }
    startSmallTalk(room, now);
    for (const helper of helpers.values())
        HelperBehaviorUtil.beat(helper, surroundingsOf(helper, room), now, helper.lines.length > 0);
}

// Two helpers near each other, neither held, chat now and then while the user is there to see it (a ghost isn't), in
// words the server gives, as a multiplayer room's would.
function startSmallTalk(room: Room, now: number): void
{
    if (state.askingSmallTalk || getMyPosition() == undefined)
        return;
    const free = [...helpers.values()].filter(helper => !NpcGameObject.isHeld(helper.objectId));
    const pair = HelperBehaviorUtil.findSmallTalkPair(free, room.voxelGrid.voxels, now);
    if (pair == undefined)
        return;
    state.askingSmallTalk = true;
    void HelperAPIClient.smallTalk(pair.map(helper => ({name: helper.name, personality: helper.prefs.personality})))
        .then(lines => {
            // Only while both are still helpers in the room the user is in, and not held (whether they are still free
            // to, startSmallTalk asks).
            const stillFree = pair.every(helper => helpers.get(helper.objectId) === helper
                && !NpcGameObject.isHeld(helper.objectId));
            HelperBehaviorUtil.startSmallTalk(pair, stillFree ? lines : [], Date.now());
        })
        .finally(() => { state.askingSmallTalk = false; });
}

// Every NPC of the room whose personality is played is a helper; one made no longer played goes back to where it was
// put, silent.
function findHelpers(room: Room, now: number): void
{
    for (const obj of Object.values(room.objectById))
    {
        if (obj.objectTypeIndex != NPC_TYPE_INDEX || !HelperBehaviorUtil.isPlayed(obj))
            continue;
        const helper = helpers.get(obj.objectId) ?? {...HelperBehaviorUtil.create(obj, now), objectId: obj.objectId,
            greeted: false, lines: [], linesAt: 0, held: false};
        HelperBehaviorUtil.takeSettings(helper, obj, now);
        helpers.set(obj.objectId, helper);
    }
    for (const [objectId, helper] of helpers)
    {
        const obj = room.objectById[objectId];
        if (obj != undefined && obj.objectTypeIndex == NPC_TYPE_INDEX && HelperBehaviorUtil.isPlayed(obj))
            continue;
        if (obj != undefined)
        {
            const surroundings = surroundingsOf(helper, room);
            HelperBehaviorUtil.standAtHome(helper, surroundings);
            HelperBehaviorUtil.fallSilent(helper, surroundings);
        }
        HelperBehaviorUtil.endSmallTalk(helper);
        helpers.delete(objectId);
    }
}

// Held, it stands at home, where the admin edits it; let go of, where they left it is home.
function followHold(helper: SinglePlayerHelper, room: Room, surroundings: HelperSurroundings, now: number): void
{
    const held = NpcGameObject.isHeld(helper.objectId);
    if (held && !helper.held)
        HelperBehaviorUtil.standAtHome(helper, surroundings);
    else if (!held && helper.held)
    {
        const obj = room.objectById[helper.objectId];
        helper.home = {...obj.transform.pos};
        helper.homeQuarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
        helper.at = {...helper.home};
        helper.path = [];
        HelperBehaviorUtil.letGo(helper, now);
    }
    helper.held = held;
}

// Once the user has paused, and it has said all it was saying, it asks the server what to answer, and stops to say it.
function answer(helper: SinglePlayerHelper, room: Room, now: number): void
{
    const user = App.getUser();
    if (user == undefined || helper.lines.length == 0 || helper.answering != undefined || helper.bubbles.length > 0
        || now - helper.linesAt < ANSWER_PAUSE_MS)
    {
        return;
    }
    const text = helper.lines.slice(-MAX_LINES_ASKED).join(" ");
    helper.lines = [];
    HelperBehaviorUtil.startAnswering(helper, surroundingsOf(helper, room), user.id, now);
    void HelperAPIClient.reply(helper.objectId, helper.name, helper.prefs.personality, text).then(reply => {
        const room = App.getCurrentRoom();
        if (reply.length == 0 || room == undefined || helpers.get(helper.objectId) !== helper)
            return;
        HelperBehaviorUtil.meet(helper, surroundingsOf(helper, room), user.id, Date.now());
        HelperBehaviorUtil.sayAnswer(helper, reply, [user.id], Date.now());
    }).finally(() => {
        // Shown only while it is still a helper in the room the user is in (see findHelpers).
        const room = App.getCurrentRoom();
        if (room != undefined && helpers.get(helper.objectId) === helper)
            HelperBehaviorUtil.stopAnswering(helper, surroundingsOf(helper, room));
        else
            helper.answering = undefined;
    });
}

// The room as its behavior asks of it: the user alone is about, and what it does is shown in the room itself.
function surroundingsOf(helper: SinglePlayerHelper, room: Room): HelperSurroundings
{
    return {
        voxels: room.voxelGrid.voxels,
        getPeople: () => {
            const me = getMyPosition();
            return (me == undefined) ? [] : [me];
        },
        getPerson: (userID: string) => (userID == App.getUser()?.id) ? getMyPosition() : undefined,
        getOtherHelpers: () => [...helpers.values()].filter(other => other !== helper).map(other => other.at),
        hasLinesWaiting: () => helper.lines.length > 0,
        isHeld: () => NpcGameObject.isHeld(helper.objectId),
        showAt: () => {
            const scale = room.objectById[helper.objectId]?.transform.scale ?? {x: 1, y: 1, z: 1};
            ClientObjectManager.setObjectTransform(helper.objectId,
                new ObjectTransform({...helper.at}, {...UP}, {...scale}), true, false);
        },
        showFacing: () => ClientObjectManager.setObjectMetadata(helper.objectId, ObjectMetadataKeyEnumMap.Facing,
            NpcFacingUtil.encode(helper.facing), false),
        showSaying: () => ClientObjectManager.setObjectMetadata(helper.objectId, ObjectMetadataKeyEnumMap.SentMessage,
            helper.saying, false),
        showThinking: () => ClientObjectManager.setObjectMetadata(helper.objectId, ObjectMetadataKeyEnumMap.Thinking,
            helper.thinking ? "1" : "", false),
    };
}

// The user's player, at its middle; none for a ghost, which helpers neither greet nor hear (see AdminPrefsUtil.isGhost).
function getMyPosition(): Vec3 | undefined
{
    const player = ClientObjectManager.getMyPlayer();
    if (player == undefined || AdminPrefsUtil.isGhost(player.params))
        return undefined;
    return {x: player.position.x, y: player.position.y, z: player.position.z};
}
