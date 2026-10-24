import BehaviorPrefs from "../types/behaviorPrefs";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import NpcPersonalityMap from "../maps/npcPersonalityMap";
import StringUtil from "../../math/util/stringUtil";
import NumUtil from "../../math/util/numUtil";

// Character positions in the stored string, one base-94 character per field (see StringUtil). Never reorder; append
// only (missing characters default).
const PERSONALITY_CHAR_INDEX = 0;
const WANDER_RADIUS_CHAR_INDEX = 1;
const CAN_CLIMB_CHAR_INDEX = 2;
const ANCHORED_TO_HOME_CHAR_INDEX = 3;
const MIN_IDLE_TIME_CHAR_INDEX = 4;
const MAX_IDLE_TIME_CHAR_INDEX = 5;

// In whole world units, each stored as the number itself: at most a room's width corner to corner, so from anywhere in
// it the whole room.
export const MAX_WANDER_RADIUS = 45;
const DEFAULT_WANDER_RADIUS = 3;
// In whole seconds, likewise.
export const SHORTEST_IDLE_TIME = 1;
export const LONGEST_IDLE_TIME = 30;
const DEFAULT_MIN_IDLE_TIME = 20;
const DEFAULT_MAX_IDLE_TIME = LONGEST_IDLE_TIME;

// Encodes and decodes BehaviorPrefs. Decoding is total, so any string (including "") is a valid value: by default a guide
// going a little way from home on its own floor now and then, and back home after each wander. Who may set them is the
// type's rule.
const BehaviorPrefsUtil =
{
    decode: (prefs: string): BehaviorPrefs =>
    {
        const read = (charIndex: number, fallback: number) =>
            StringUtil.convertVisibleASCIIToRawNumber(prefs, charIndex, fallback);
        const readIdleTime = (charIndex: number, fallback: number) =>
            NumUtil.clampInRange(read(charIndex, fallback), SHORTEST_IDLE_TIME, LONGEST_IDLE_TIME);
        const idleTimes = [readIdleTime(MIN_IDLE_TIME_CHAR_INDEX, DEFAULT_MIN_IDLE_TIME),
            readIdleTime(MAX_IDLE_TIME_CHAR_INDEX, DEFAULT_MAX_IDLE_TIME)];
        return {
            personality: NpcPersonalityMap.fromCode(read(PERSONALITY_CHAR_INDEX, 0)),
            wanderRadius: Math.min(read(WANDER_RADIUS_CHAR_INDEX, DEFAULT_WANDER_RADIUS), MAX_WANDER_RADIUS),
            canClimb: read(CAN_CLIMB_CHAR_INDEX, 0) != 0,
            anchoredToHome: read(ANCHORED_TO_HOME_CHAR_INDEX, 1) != 0,
            // A pair the wrong way round is read the right way.
            minIdleTime: Math.min(...idleTimes),
            maxIdleTime: Math.max(...idleTimes),
        };
    },
    // A radius or a time between whole units goes to the nearest.
    encode: (prefs: BehaviorPrefs): string =>
    {
        const radius = Number.isFinite(prefs.wanderRadius) ? Math.round(prefs.wanderRadius) : DEFAULT_WANDER_RADIUS;
        const idleTime = (time: number, fallback: number) => NumUtil.clampInRange(
            Number.isFinite(time) ? Math.round(time) : fallback, SHORTEST_IDLE_TIME, LONGEST_IDLE_TIME);
        const chars: string[] = [];
        chars[PERSONALITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            NpcPersonalityMap.toCode(prefs.personality));
        chars[WANDER_RADIUS_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            NumUtil.clampInRange(radius, 0, MAX_WANDER_RADIUS));
        chars[CAN_CLIMB_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(prefs.canClimb ? 1 : 0);
        chars[ANCHORED_TO_HOME_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(prefs.anchoredToHome ? 1 : 0);
        chars[MIN_IDLE_TIME_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            idleTime(prefs.minIdleTime, DEFAULT_MIN_IDLE_TIME));
        chars[MAX_IDLE_TIME_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            idleTime(prefs.maxIdleTime, DEFAULT_MAX_IDLE_TIME));
        return chars.join("");
    },
    canonicalize: (prefs: string): string =>
    {
        return BehaviorPrefsUtil.encode(BehaviorPrefsUtil.decode(prefs));
    },
    getObjectPrefs: (obj: AddObjectSignal): BehaviorPrefs =>
    {
        return BehaviorPrefsUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.BehaviorPrefs]?.str ?? "");
    },
}

export default BehaviorPrefsUtil;
