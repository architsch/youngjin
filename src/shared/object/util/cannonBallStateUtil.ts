import Vec3 from "../../math/types/vec3";
import StringUtil from "../../math/util/stringUtil";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import CannonBallState from "../types/cannonBallState";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { CANNON_BALL_MAX_SPEED, CANNON_BALL_VANISH_DISTANCE } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// Character positions in the stored string (see StringUtil). The first is the key's switch, which a ball has none of
// (see CannonStateUtil.merge); each coordinate takes two, and its bounces follow its velocity (none, in a string that
// ends before them). Never reorder. A burst ball, which no save ever holds, keeps in its velocity's place whom it
// struck (their place in the list of those it threw, counted from 1, or 0 for nobody), the way that throws them, in
// two characters, and then that list.
const BURST_CHAR_INDEX = 1;
const POS_CHAR_INDEX = 2;
const VEL_CHAR_INDEX = 8;
const BOUNCES_CHAR_INDEX = 14;
const STRUCK_CHAR_INDEX = 8;
const STRUCK_HEADING_CHAR_INDEX = 9;
const HIT_IDS_CHAR_INDEX = 11;
const HIT_ID_SEPARATOR = ",";
// The most a character holds (see StringUtil.convertVisibleASCIIToRawNumber).
const MAX_RAW = 93;
// How many bounces are counted before the count starts over.
const BOUNCE_COUNT_SPAN = MAX_RAW + 1;
// How far past the room a place is stored, in world units: past where a ball is removed. A transform holds none
// beyond the room (see ObjectTransform), which is why a ball's place is kept here.
const POS_MARGIN = CANNON_BALL_VANISH_DISTANCE + 4;
// What each part of a velocity is stored within, in world units a second.
const MAX_STORED_SPEED = CANNON_BALL_MAX_SPEED + 2;

const AXES: {axis: "x" | "y" | "z", max: number}[] = [{axis: "x", max: MAX_ROOM_X}, {axis: "y", max: MAX_ROOM_Y},
    {axis: "z", max: MAX_ROOM_Z}];

// Encodes and decodes a cannon ball's state: where it is, how it moves and how many times it has bounced, or, once it
// has burst, where it burst, whom its blast threw, and which of them it struck, thrown which way. Decoding is total.
const CannonBallStateUtil =
{
    // A count of bounces after one more, which starts over past what a character holds.
    countBounce: (bounces: number): number =>
    {
        return (bounces + 1) % BOUNCE_COUNT_SPAN;
    },
    // Whether a count is of more bounces than another, the two being of one ball and so never far apart: ahead of it
    // by less than half the way round.
    isBounceCountAhead: (bounces: number, than: number): boolean =>
    {
        const ahead = (bounces - than + BOUNCE_COUNT_SPAN) % BOUNCE_COUNT_SPAN;
        return ahead > 0 && ahead < 0.5 * BOUNCE_COUNT_SPAN;
    },
    decode: (state: string): CannonBallState =>
    {
        const exploded = StringUtil.convertVisibleASCIIToRawNumber(state, BURST_CHAR_INDEX, 0) != 0;
        const pos: Vec3 = {x: 0, y: 0, z: 0};
        const vel: Vec3 = {x: 0, y: 0, z: 0};
        AXES.forEach(({axis, max}, i) => {
            pos[axis] = StringUtil.convertVisibleASCIIPairToNumber(state, POS_CHAR_INDEX + 2 * i, -POS_MARGIN,
                max + POS_MARGIN, 0);
            if (!exploded)
            {
                vel[axis] = StringUtil.convertVisibleASCIIPairToNumber(state, VEL_CHAR_INDEX + 2 * i, -MAX_STORED_SPEED,
                    MAX_STORED_SPEED, 0);
            }
        });
        const hitIds = exploded ? state.slice(HIT_IDS_CHAR_INDEX) : "";
        const hitObjectIds = (hitIds.length > 0) ? hitIds.split(HIT_ID_SEPARATOR) : [];
        const struckObjectId = exploded
            ? hitObjectIds[StringUtil.convertVisibleASCIIToRawNumber(state, STRUCK_CHAR_INDEX, 0) - 1] : undefined;
        const struck = (struckObjectId == undefined) ? undefined : {objectId: struckObjectId,
            heading: StringUtil.convertVisibleASCIIPairToNumber(state, STRUCK_HEADING_CHAR_INDEX, -Math.PI, Math.PI, 0)};
        const bounces = exploded ? 0 : StringUtil.convertVisibleASCIIToRawNumber(state, BOUNCES_CHAR_INDEX, 0);
        return {pos, vel, exploded, hitObjectIds, struck, bounces};
    },
    encode: (state: CannonBallState): string =>
    {
        const pos = AXES.map(({axis, max}) =>
            StringUtil.convertNumberToVisibleASCIIPair(state.pos[axis], -POS_MARGIN, max + POS_MARGIN)).join("");
        const head = StringUtil.convertRawNumberToVisibleASCII(0)
            + StringUtil.convertRawNumberToVisibleASCII(state.exploded ? 1 : 0) + pos;
        if (state.exploded)
        {
            // (Nobody, for one it didn't throw, or one farther down the list than a character counts to.)
            const struckIndex = (state.struck == undefined) ? -1 : state.hitObjectIds.indexOf(state.struck.objectId);
            const struckPlace = (struckIndex < MAX_RAW) ? struckIndex + 1 : 0;
            const heading = (struckPlace > 0) ? state.struck!.heading : 0;
            return head + StringUtil.convertRawNumberToVisibleASCII(struckPlace)
                + StringUtil.convertNumberToVisibleASCIIPair(heading, -Math.PI, Math.PI)
                + state.hitObjectIds.join(HIT_ID_SEPARATOR);
        }
        return head + AXES.map(({axis}) =>
            StringUtil.convertNumberToVisibleASCIIPair(state.vel[axis], -MAX_STORED_SPEED, MAX_STORED_SPEED)).join("")
            + StringUtil.convertRawNumberToVisibleASCII(state.bounces % BOUNCE_COUNT_SPAN);
    },
    getObjectState: (obj: AddObjectSignal): CannonBallState =>
    {
        return CannonBallStateUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.CannonState]?.str ?? "");
    },
}

export default CannonBallStateUtil;
