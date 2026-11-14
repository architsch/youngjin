import Vec3 from "../../math/types/vec3";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import AddObjectSignal from "../types/addObjectSignal";
import CannonAim from "../types/cannonAim";
import CannonState from "../types/cannonState";
import { CannonPhaseEnumMap } from "../types/cannonPhase";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { CANNON_BALL_COUNT, CANNON_MAX_PITCH, CANNON_MIN_PITCH, CANNON_REST_SECONDS,
    CANNON_SHOTS_IN_A_ROW } from "../types/objectTypeConfig/cannonObjectTypeConfig";
import CannonAimUtil from "./cannonAimUtil";

// Character positions in the stored string (see StringUtil); the aim's angles and the time take two each. Never
// reorder; append only (missing characters default).
const SWITCH_CHAR_INDEX = 0;
const PHASE_CHAR_INDEX = 1;
const BALLS_CHAR_INDEX = 2;
const YAW_CHAR_INDEX = 3;
const PITCH_CHAR_INDEX = 5;
const TIME_CHAR_INDEX = 7;
const SHOTS_CHAR_INDEX = 9;
// What a phase's time left is stored within, in seconds: longer than any phase lasts.
const MAX_TIME_LEFT = 16;
// How a new cannon's barrel is raised, in radians.
const DEFAULT_PITCH = 0.3;
const MAX_VALUE_LENGTH = 128;

const phases = Object.values(CannonPhaseEnumMap);

// Encodes and decodes a cannon's state. Decoding is total, so any string (including "") is a valid value: by default
// a cannon just installed, switched on, with all its balls. The key's first character is its user's to set, and the
// rest the server's (see merge), which a cannon ball's state shares the key under (see CannonBallStateUtil).
const CannonStateUtil =
{
    decode: (state: string): CannonState =>
    {
        const phase = StringUtil.convertVisibleASCIIToRawNumber(state, PHASE_CHAR_INDEX, CannonPhaseEnumMap.Resting);
        return {
            on: readSwitch(state),
            phase: phases.includes(phase) ? phase : CannonPhaseEnumMap.Resting,
            ballsLeft: Math.min(CANNON_BALL_COUNT,
                StringUtil.convertVisibleASCIIToRawNumber(state, BALLS_CHAR_INDEX, CANNON_BALL_COUNT)),
            aim: {
                yaw: StringUtil.convertVisibleASCIIPairToNumber(state, YAW_CHAR_INDEX, 0, 2 * Math.PI, 0),
                pitch: StringUtil.convertVisibleASCIIPairToNumber(state, PITCH_CHAR_INDEX, CANNON_MIN_PITCH,
                    CANNON_MAX_PITCH, DEFAULT_PITCH),
            },
            timeLeft: StringUtil.convertVisibleASCIIPairToNumber(state, TIME_CHAR_INDEX, 0, MAX_TIME_LEFT,
                CANNON_REST_SECONDS),
            shotsInARow: Math.min(CANNON_SHOTS_IN_A_ROW, StringUtil.convertVisibleASCIIToRawNumber(state, SHOTS_CHAR_INDEX, 0)),
        };
    },
    encode: (state: CannonState): string =>
    {
        const chars: string[] = [];
        chars[SWITCH_CHAR_INDEX] = encodeSwitchChar(state.on);
        chars[PHASE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            phases.includes(state.phase) ? state.phase : CannonPhaseEnumMap.Resting);
        chars[BALLS_CHAR_INDEX] = encodeCount(state.ballsLeft, CANNON_BALL_COUNT);
        chars[YAW_CHAR_INDEX] = StringUtil.convertNumberToVisibleASCIIPair(state.aim.yaw, 0, 2 * Math.PI);
        chars[PITCH_CHAR_INDEX] = StringUtil.convertNumberToVisibleASCIIPair(state.aim.pitch, CANNON_MIN_PITCH,
            CANNON_MAX_PITCH);
        chars[TIME_CHAR_INDEX] = StringUtil.convertNumberToVisibleASCIIPair(state.timeLeft, 0, MAX_TIME_LEFT);
        chars[SHOTS_CHAR_INDEX] = encodeCount(state.shotsInARow, CANNON_SHOTS_IN_A_ROW);
        return chars.join("");
    },
    // What a value set under the key leaves stored, given what the object holds there (nothing, as it is added). One
    // character sets the switch alone; anything longer sets the rest, and keeps the switch the object has. So a user,
    // who may set only one character (see CannonObjectTypeConfig), never touches what the server keeps, nor does what
    // the server tells of that undo a switch its user has just thrown. The server's own throw, ending a row of shots,
    // is told as a user's is.
    merge: (rawValue: string, currentValue?: string): string =>
    {
        const value = StringUtil.truncateByCodePoints(rawValue, MAX_VALUE_LENGTH);
        if (CannonStateUtil.isSwitch(value))
            return encodeSwitchChar(readSwitch(value)) + (currentValue ?? "").slice(1);
        const kept = (currentValue != undefined && currentValue.length > 0) ? currentValue : value;
        return encodeSwitchChar(readSwitch(kept)) + value.slice(1);
    },
    // The value that sets a cannon's switch alone (see merge).
    encodeSwitch: (on: boolean): string =>
    {
        return encodeSwitchChar(on);
    },
    isSwitch: (value: string): boolean =>
    {
        return value.length <= 1;
    },
    // What of a stored state's server's part shows: all but the time left and the shots in a row, which only the
    // server counts, and tells nobody of.
    getShownPart: (state: string): string =>
    {
        return state.slice(PHASE_CHAR_INDEX, TIME_CHAR_INDEX);
    },
    getObjectState: (obj: AddObjectSignal): CannonState =>
    {
        return CannonStateUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.CannonState]?.str ?? "");
    },
    // Whether a cannon has fired its last ball. (An object holding no state under the key reads as one with all of
    // them.)
    isSpent: (obj: AddObjectSignal): boolean =>
    {
        return CannonStateUtil.getObjectState(obj).ballsLeft <= 0;
    },
    // Where its barrel shows pointing, on the face it stands on: as it aims, or hanging down, asleep, while it is
    // switched off.
    getShownAim: (state: CannonState, facing: Vec3): CannonAim =>
    {
        return state.on ? state.aim : CannonAimUtil.getSleepAim(facing, state.aim);
    },
}

// On, unless it says otherwise.
function readSwitch(state: string): boolean
{
    return StringUtil.convertVisibleASCIIToRawNumber(state, SWITCH_CHAR_INDEX, 1) != 0;
}

function encodeSwitchChar(on: boolean): string
{
    return StringUtil.convertRawNumberToVisibleASCII(on ? 1 : 0);
}

function encodeCount(count: number, most: number): string
{
    return StringUtil.convertRawNumberToVisibleASCII(
        Number.isFinite(count) ? Math.round(NumUtil.clampInRange(count, 0, most)) : 0);
}

export default CannonStateUtil;
