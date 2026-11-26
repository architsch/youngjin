import Vec3 from "../../math/types/vec3";
import { PetAction } from "./petAction";
import { PetEditKind } from "./petEditKind";
import { PetExpression } from "./petExpression";
import PetIdentity from "./petIdentity";
import PetLine from "./petLine";
import PetNeeds from "./petNeeds";
import PetNotice from "./petNotice";
import { PetSpeechTone } from "./petSpeechTone";

// A pet as its behavior has it, wherever it is played (see PetBehaviorUtil). Times are whoever plays it's own clock, in
// milliseconds.
type PetBehavior = {
    objectId: string,
    ownerUserID: string,
    identity: PetIdentity,
    needs: PetNeeds,
    // Where its feet are and the way it looks across the floor (see NpcFacingUtil), as whoever plays it last moved it.
    at: Vec3,
    facing: number,

    // What it is doing, since when, and until when if that ends by itself; and what it is about (see PetShownState).
    action: PetAction,
    actionSince: number,
    actionUntil: number,
    targetId: string,
    // Out of health: nothing is left to play.
    dead: boolean,

    // Its way: the points of the floor still to go to, the next first, and how fast; counted up each time it sets off
    // another way, so that whoever plays it can tell. backingOff: it goes there without turning to it. standFacing: the
    // way it turns to while it stands, if any.
    path: Vec3[],
    speed: number,
    pathRevision: number,
    // Where the way it last set off on ends, by which a way set again is told from another (see PetBehaviorUtil).
    pathEnd: Vec3 | undefined,
    backingOff: boolean,
    standFacing: number | undefined,
    // Whether it stands turning to its way before it goes on, and the way that lies (see PetBehaviorUtil.steer).
    turning: boolean,
    wayFacing: number | undefined,
    // Where and when it last got anywhere on its way, by which it gives a way up; and whether it has just done so.
    progressFrom: Vec3,
    progressAt: number,
    stuck: boolean,

    // What it says, how that is colored, until when it is still being read (which paces what it does), until when it
    // stays up, and whom it is said to: a person's player object, or "" for nobody in particular.
    saying: string,
    tone: PetSpeechTone,
    sayingUntil: number,
    bubbleUntil: number,
    addressee: string,
    // The face it shows, which follows from the rest: the mood of what it says or does (see PetLine) until a time, and
    // a start it gives until another.
    expression: PetExpression,
    mood: number,
    moodUntil: number,
    startledUntil: number,
    excited: boolean,
    // How many times it has struck what it attacks (see PetShownState.hits).
    hits: number,

    // When it may next do each of the things it does of its own accord.
    nextWanderAt: number,
    nextFollowAt: number,
    nextTalkAt: number,
    nextRemarkAt: number,
    nextEditRemarkAt: number,
    nextHugAt: number,
    nextAttackAt: number,
    nextPersonRemarkAt: number,
    nextNeedWordsAt: number,
    // Until when it begins none of those of its own accord, having just been at one.
    quietUntil: number,
    // Until when it is kept standing idle and silent, whatever else it would do (see PetBehaviorUtil.hold).
    heldUntil: number,
    // Until when it may still be on its way into the room, doing nothing else (see PetBehaviorUtil.enter); 0 once it is
    // in.
    enteringUntil: number,
    // What has happened to it that it is still to react to (see PetNotice).
    notices: PetNotice[],

    // A chat with another pet: which, how many of its lines have been said, whether this one began it, when it speaks
    // next (once the last line has been read), and when it gives up waiting on the other.
    topic: number,
    turn: number,
    talkStarter: boolean,
    talkNextAt: number,
    talkDeadline: number,
    // Whom it last chatted with, whose asking it passes over until then: one whose own player has stopped playing it goes
    // on asking for good.
    talkedWith: string,
    talkedWithUntil: number,
    // The pet that asks it to chat, and when it takes that up.
    invitation: {byId: string, due: number} | undefined,
    // An attack: whether it is closing in (or backing off for another go), and until when it backs off.
    charging: boolean,
    backOffUntil: number,
    // A hug: until when it keeps by them, once it has reached them.
    pressUntil: number,
    // When it was last attacked, and which pets it has seen attacking, so that it notices one begin; and the pet that
    // has just set on it, with when it starts at that.
    lastAttackedAt: number,
    seenAttacking: {[objectId: string]: boolean},
    setOn: {byId: string, due: number} | undefined,
    // Where what last frightened it was, which it runs from.
    frightAt: Vec3 | undefined,
    // Whether its owner was farther off than it lets them be when it last looked.
    strayed: boolean,
    // Where its feet were bound the last few times it went somewhere by itself, the latest last: the places it knows.
    visited: Vec3[],
    // Something someone has just done near it, which it means to say a word on, from when it has taken it in until then,
    // with where they watch it from, if that is known; and once it has set off to say it, where the thing is, its word,
    // and until when it may still be on its way there.
    pendingEdit: {kind: PetEditKind, at: Vec3, byUserID: string, viewFrom: Vec3 | undefined, from: number,
        until: number} | undefined,
    editVisit: {at: Vec3, line: PetLine, until: number} | undefined,
    // Who has just said its name, whom it means to go to, likewise; and, once it has got to them, until when it stays.
    calledBy: {userID: string, from: number, until: number} | undefined,
    stayUntil: number,
    // Who has just spoken to it, by their player's object, whom it means to turn to, likewise; and its answer to
    // someone, until it is too late to say.
    heard: {personObjectId: string, from: number, until: number} | undefined,
    reply: {personObjectId: string, line: PetLine, until: number} | undefined,
    // How far off whoever it is turned to may go before it leaves them (see PetBehaviorUtil).
    chatReach: number,
    // Whether what it asks for next, when it has two things to ask for, is a battery.
    asksForBatteryNext: boolean,
};

export default PetBehavior;
