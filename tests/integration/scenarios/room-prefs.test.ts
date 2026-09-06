/**
 * Scenario tests: a room's atmosphere
 *
 * What light fills a room, what light the player carries while standing in it, and what the air
 * between the two is like are settings the room carries and the whole of what these cover:
 *
 * - that the settings survive the handful of characters they are stored as
 * - that **a room that has said nothing looks exactly as rooms looked before it could say anything**,
 *   which is the promise that lets every existing room go untouched
 * - that decoding is total, so nothing downstream has to carry a check for a value that is not one
 * - that the fog's two distances always leave a span between them, however they were set
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import RoomPrefsUtil, { MAX_AMBIENT_INTENSITY, MAX_FOG_DISTANCE, MAX_ROOM_PREFS_STEP } from "../../../src/shared/room/util/roomPrefsUtil";
import RoomPrefs from "../../../src/shared/room/types/roomPrefs";
import HeadLightPowerUtil from "../../../src/shared/graphics/light/util/headLightPowerUtil";
import LampLightUtil from "../../../src/shared/graphics/light/util/lampLightUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME } from "../../../src/shared/system/sharedConstants";

// The reach of a camera at the player's own eye, past which nothing is drawn. Written here rather
// than imported because it belongs to the renderer's camera; what matters is only that the default
// fog is beyond it.
const CAMERA_FAR_PLANE = 45;

// Every character the encoding can carry, so that a decoded string is exercised over its whole
// domain rather than over the values this code happens to write.
const prefsStrings = fc.array(fc.integer({min: 33, max: 126}), {maxLength: 12})
    .map(codes => codes.map(code => String.fromCharCode(code)).join(""));

// Any string at all, including the ones a stored value could never be — which is the point: what is
// read back off a room is whatever is in the document, not whatever this version last wrote there.
const arbitraryStrings = fc.string({maxLength: 20});

const steps = fc.integer({min: 0, max: MAX_ROOM_PREFS_STEP});

function arbitraryPrefs(): fc.Arbitrary<RoomPrefs>
{
    return fc.record({
        ambientColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1}),
        ambientIntensityStep: steps,
        headLightColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1}),
        headLightPowerStep: steps,
        fogColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME) - 1}),
        fogNearStep: steps,
        fogFarStep: steps,
    });
}

describe("room prefs encoding", () => {
    it("brings a room's settings back exactly as they were stored", () => {
        fc.assert(fc.property(arbitraryPrefs(), (prefs) => {
            expect(RoomPrefsUtil.decode(RoomPrefsUtil.encode(prefs))).toEqual(prefs);
        }));
    });

    it("stores only what a room can be read back from", () => {
        // Canonicalizing is the server's whole validation (see ServerRoomManager.changeRoomPrefs),
        // so it has to be a fixed point: a string that has been through it once must survive being
        // put through it again unchanged, or a room would drift every time it was saved.
        const canonicalize = (raw: string) => RoomPrefsUtil.encode(RoomPrefsUtil.decode(raw));
        fc.assert(fc.property(arbitraryStrings, (raw) => {
            const once = canonicalize(raw);
            expect(canonicalize(once)).toBe(once);
        }));
    });

    it("reads a room back from any string at all", () => {
        fc.assert(fc.property(arbitraryStrings, (raw) => {
            const prefs = RoomPrefsUtil.decode(raw);
            expect(Number.isInteger(prefs.headLightPowerStep)).toBe(true);
            expect(prefs.headLightPowerStep).toBeGreaterThanOrEqual(0);
            expect(prefs.headLightPowerStep).toBeLessThanOrEqual(MAX_ROOM_PREFS_STEP);
            expect(prefs.ambientColorIndex).toBeLessThan(
                ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME));
            expect(prefs.headLightColorIndex).toBeLessThan(
                ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME));
            expect(prefs.fogColorIndex).toBeLessThan(
                ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME));
        }));
    });

    it("keeps the fog's two distances apart, however they were set", () => {
        // Fog whose distances meet is not thin fog but undefined fog — the shader divides by the
        // span between them — so this holds for every pair of steps, including the pair a room that
        // has said nothing decodes to.
        fc.assert(fc.property(prefsStrings, (raw) => {
            const prefs = RoomPrefsUtil.decode(raw);
            expect(RoomPrefsUtil.getFogFarDistance(prefs))
                .toBeGreaterThan(RoomPrefsUtil.getFogNearDistance(prefs));
        }));
    });
});

describe("a room that has said nothing", () => {
    // These are the whole promise that no existing room has to be brought up to date: an empty
    // string is what every room stored before any of this existed, and it has to come back meaning
    // exactly what those rooms already looked like.
    const defaults = RoomPrefsUtil.decode("");

    it("is lit in plain white", () => {
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][defaults.ambientColorIndex])
            .toBe("#ffffff");
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][defaults.headLightColorIndex])
            .toBe("#ffffff");
    });

    it("is filled at exactly the ambient strength it always had", () => {
        // The one number in here that predates a room being able to say anything about its
        // lighting, so it is the one that would show if the default drifted.
        expect(RoomPrefsUtil.getAmbientIntensity(defaults)).toBe(0.15);
    });

    it("carries the head lamp at full strength", () => {
        expect(defaults.headLightPowerStep).toBe(MAX_ROOM_PREFS_STEP);
        expect(HeadLightPowerUtil.getIntensity(defaults.headLightPowerStep)).toBe(4.0);
        expect(HeadLightPowerUtil.getDistance(defaults.headLightPowerStep)).toBe(16);
        expect(HeadLightPowerUtil.getDecay(defaults.headLightPowerStep)).toBe(0.5);
    });

    it("has no fog the camera can reach", () => {
        expect(RoomPrefsUtil.getFogNearDistance(defaults)).toBeGreaterThanOrEqual(CAMERA_FAR_PLANE);
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][defaults.fogColorIndex]).toBe("#000000");
    });

    it("is what a shorter string from some other version decodes to as well", () => {
        // Every field past the end of the string falls back on its own default, which is what makes
        // the format extendable in both directions rather than versioned.
        const partial = RoomPrefsUtil.decode(RoomPrefsUtil.encode(defaults).substring(0, 2));
        expect(partial).toEqual(defaults);
    });

    it("is what generation writes out explicitly", () => {
        // The obligation is to *decide*, and the decision here is the default — but it is written
        // rather than left empty, so no room is ever holding a value nothing chose.
        // See @.claude/rules/room-generation.md .
        expect(RoomPrefsUtil.getDefaultPrefsString().length).toBeGreaterThan(0);
        expect(RoomPrefsUtil.decode(RoomPrefsUtil.getDefaultPrefsString())).toEqual(defaults);
    });
});

describe("power as one setting", () => {
    it("gives the head lamp nothing at its bottom step and everything at its top", () => {
        expect(HeadLightPowerUtil.getIntensity(0)).toBe(0);
        expect(HeadLightPowerUtil.getIntensity(MAX_ROOM_PREFS_STEP))
            .toBeGreaterThan(HeadLightPowerUtil.getIntensity(0));
    });

    it("leaves a lamp a light even at its lowest", () => {
        // A lamp is furniture rather than a torch: one turned all the way down is a small light,
        // not a dark fitting, since there would be nothing on screen to tell that from a broken one.
        expect(LampLightUtil.getIntensity(0)).toBeGreaterThan(0);
        expect(LampLightUtil.getRange(0)).toBeGreaterThan(0);
    });

    it("lets a lamp be turned far past what lighting a room takes", () => {
        // The top of the range exists for effect rather than for visibility: a lamp that blows out
        // the wall it is mounted on is the thing being asked for, so it has to reach well past the
        // strength that merely lights a room.
        expect(LampLightUtil.getIntensity(MAX_ROOM_PREFS_STEP))
            .toBeGreaterThan(3 * LampLightUtil.getIntensity(DEFAULT_LAMP_STEP));
    });

    it("never lets either grow dimmer as it is turned up", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(HeadLightPowerUtil.getIntensity(high))
                .toBeGreaterThanOrEqual(HeadLightPowerUtil.getIntensity(low));
            expect(HeadLightPowerUtil.getDistance(high))
                .toBeGreaterThanOrEqual(HeadLightPowerUtil.getDistance(low));
            expect(LampLightUtil.getIntensity(high))
                .toBeGreaterThanOrEqual(LampLightUtil.getIntensity(low));
        }));
    });

    it("gives a lamp two dials that do not move together", () => {
        // The whole point of splitting them: a dim wash and a tight bright pool both have to be
        // askable for, which they are not while one dial drives strength and reach at once.
        expect(LampLightUtil.getIntensity(0)).toBe(LampLightUtil.getIntensity(0));
        expect(LampLightUtil.getRange(0)).toBeLessThan(LampLightUtil.getRange(MAX_ROOM_PREFS_STEP));
        // Reach and falloff run opposite ways, so a wide lamp is wide rather than merely long-range.
        expect(LampLightUtil.getDecay(0))
            .toBeGreaterThan(LampLightUtil.getDecay(MAX_ROOM_PREFS_STEP));
    });

    it("widens a lamp's reach as its spread is raised", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(LampLightUtil.getRange(high)).toBeGreaterThanOrEqual(LampLightUtil.getRange(low));
            expect(LampLightUtil.getDecay(high)).toBeLessThanOrEqual(LampLightUtil.getDecay(low));
        }));
    });

    it("shortens the head lamp's reach along with its strength", () => {
        // Which is what makes a dim head lamp read as a smaller lamp rather than as the whole room
        // turned down by a dial.
        expect(HeadLightPowerUtil.getDistance(0))
            .toBeLessThan(HeadLightPowerUtil.getDistance(MAX_ROOM_PREFS_STEP));
    });

    it("runs the ambient from nothing to well past where it sits by default", () => {
        expect(RoomPrefsUtil.getAmbientIntensity({...defaultPrefs, ambientIntensityStep: 0}))
            .toBe(0);
        expect(RoomPrefsUtil.getAmbientIntensity(
            {...defaultPrefs, ambientIntensityStep: MAX_ROOM_PREFS_STEP}))
            .toBe(MAX_AMBIENT_INTENSITY);
        expect(MAX_AMBIENT_INTENSITY).toBeGreaterThan(
            RoomPrefsUtil.getAmbientIntensity(defaultPrefs));
    });
});

// What a lamp arrives at when nobody has adjusted it (see LampObjectUtil).
const DEFAULT_LAMP_STEP = 62;
const defaultPrefs = RoomPrefsUtil.decode("");

describe("the palettes a room's lighting is drawn from", () => {
    it("starts each with the entry that changes nothing", () => {
        // Load-bearing: index 0 is what an unconfigured room reads back, so white light and a black
        // void are what "nobody has said anything" has to mean.
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][0]).toBe("#ffffff");
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][0]).toBe("#000000");
    });

    it("keeps both inside what one stored character can address", () => {
        expect(ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME))
            .toBeLessThanOrEqual(MAX_ROOM_PREFS_STEP + 1);
        expect(ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME))
            .toBeLessThanOrEqual(MAX_ROOM_PREFS_STEP + 1);
    });

    it("holds the fog inside the range its steps address", () => {
        const furthest = RoomPrefsUtil.decode("");
        expect(RoomPrefsUtil.getFogNearDistance(furthest)).toBe(MAX_FOG_DISTANCE);
    });
});
