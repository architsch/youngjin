import Vec3 from "../../math/types/vec3";
import StringUtil from "../../math/util/stringUtil";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import CannonBallState from "../types/cannonBallState";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { CANNON_BALL_MAX_SPEED, CANNON_BALL_VANISH_DISTANCE } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// Character positions in the stored string (see StringUtil). The first is the key's switch, which a ball has none of
// (see CannonStateUtil.merge); each coordinate takes two. Never reorder.
const BURST_CHAR_INDEX = 1;
const POS_CHAR_INDEX = 2;
const VEL_CHAR_INDEX = 8;
const HIT_IDS_CHAR_INDEX = 8;
const HIT_ID_SEPARATOR = ",";
// How far past the room a place is stored, in world units: past where a ball is removed. A transform holds none
// beyond the room (see ObjectTransform), which is why a ball's place is kept here.
const POS_MARGIN = CANNON_BALL_VANISH_DISTANCE + 4;
// What each part of a velocity is stored within, in world units a second.
const MAX_STORED_SPEED = CANNON_BALL_MAX_SPEED + 2;

const AXES: {axis: "x" | "y" | "z", max: number}[] = [{axis: "x", max: MAX_ROOM_X}, {axis: "y", max: MAX_ROOM_Y},
    {axis: "z", max: MAX_ROOM_Z}];

// Encodes and decodes a cannon ball's state: where it is and how it moves, or, once it has burst, where it burst and
// whom its blast threw. Decoding is total.
const CannonBallStateUtil =
{
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
        return {pos, vel, exploded, hitObjectIds: (hitIds.length > 0) ? hitIds.split(HIT_ID_SEPARATOR) : []};
    },
    encode: (state: CannonBallState): string =>
    {
        const pos = AXES.map(({axis, max}) =>
            StringUtil.convertNumberToVisibleASCIIPair(state.pos[axis], -POS_MARGIN, max + POS_MARGIN)).join("");
        const head = StringUtil.convertRawNumberToVisibleASCII(0)
            + StringUtil.convertRawNumberToVisibleASCII(state.exploded ? 1 : 0) + pos;
        if (state.exploded)
            return head + state.hitObjectIds.join(HIT_ID_SEPARATOR);
        return head + AXES.map(({axis}) =>
            StringUtil.convertNumberToVisibleASCIIPair(state.vel[axis], -MAX_STORED_SPEED, MAX_STORED_SPEED)).join("");
    },
    getObjectState: (obj: AddObjectSignal): CannonBallState =>
    {
        return CannonBallStateUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.CannonState]?.str ?? "");
    },
}

export default CannonBallStateUtil;
