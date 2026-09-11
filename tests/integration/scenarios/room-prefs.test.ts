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
import RoomPrefsUtil, { MAX_AMBIENT_INTENSITY, MAX_CLOUD_SCALE, MAX_CLOUD_SOFTNESS, MAX_CLOUD_SPEED,
    MAX_FOG_DISTANCE, MAX_FOG_SMOKE_SCALE, MAX_FOG_SMOKE_SPEED, MAX_GROUND_SCALE,
    MAX_GROUND_SOFTNESS, MAX_GROUND_SOLIDITY, MAX_ROOM_PREFS_STEP, MIN_CLOUD_SCALE,
    MIN_CLOUD_SOFTNESS, MIN_FOG_SMOKE_SCALE, MIN_GROUND_SCALE, MIN_GROUND_SOFTNESS,
    MIN_GROUND_SOLIDITY }
    from "../../../src/shared/room/util/roomPrefsUtil";
import RoomPrefs from "../../../src/shared/room/types/roomPrefs";
import HeadLightUtil, { ORDINARY_POWER_INTENSITY, ORDINARY_RANGE_DECAY, ORDINARY_RANGE_DISTANCE }
    from "../../../src/shared/graphics/light/util/headLightUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME,
    SCENERY_COLOR_PALETTE_NAME } from "../../../src/shared/system/sharedConstants";

// The reach of a camera at the player's own eye, past which nothing is drawn. Written here rather
// than imported because it belongs to the renderer's camera; what matters is only that the default
// fog is beyond it.
const CAMERA_FAR_PLANE = 45;

// Every character the encoding can carry, so that a decoded string is exercised over its whole
// domain rather than over the values this code happens to write.
const prefsStrings = fc.array(fc.integer({min: 33, max: 126}), {maxLength: 34})
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
        headLightRangeStep: steps,
        fogColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME) - 1}),
        fogNearStep: steps,
        fogFarStep: steps,
        skyColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME) - 1}),
        cloudColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(SCENERY_COLOR_PALETTE_NAME) - 1}),
        cloudOpacityStep: steps,
        cloudScaleStep: steps,
        cloudSoftnessStep: steps,
        cloudSpeedStep: steps,
        groundColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(SCENERY_COLOR_PALETTE_NAME) - 1}),
        groundPeakColorIndex: fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(SCENERY_COLOR_PALETTE_NAME) - 1}),
        groundScaleStep: steps,
        groundSolidityStep: steps,
        groundSoftnessStep: steps,
        fogSmokeAmplitudeStep: steps,
        fogSmokeScaleStep: steps,
        fogSmokeSpeedStep: steps,
        fogSmokeDriftStep: steps,
        fogSmokeRiseStep: steps,
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
            expect(prefs.skyColorIndex).toBeLessThan(
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
        // lighting, so it is the one that would show if the default drifted. Compared to a
        // tolerance rather than exactly, because it now arrives through a curve rather than off the
        // end of a range and lands a float's width short of itself; what is being asserted is that
        // it has not *drifted*, and a part in a hundred billion is not drift.
        expect(RoomPrefsUtil.getAmbientIntensity(defaults)).toBeCloseTo(0.15, 10);
    });

    it("carries the head lamp at the strength it always had", () => {
        // No longer the top of the range, and that is the point: the top is now an effect well past
        // the ordinary lamp, so the ordinary lamp had to move down to leave room for it. What must
        // not move is the lamp itself, which is what these three pin.
        expect(defaults.headLightPowerStep).toBeLessThan(MAX_ROOM_PREFS_STEP);
        expect(defaults.headLightRangeStep).toBeLessThan(MAX_ROOM_PREFS_STEP);
        expect(HeadLightUtil.getIntensity(defaults.headLightPowerStep))
            .toBeCloseTo(ORDINARY_POWER_INTENSITY, 10);
        expect(HeadLightUtil.getDistance(defaults.headLightRangeStep))
            .toBeCloseTo(ORDINARY_RANGE_DISTANCE, 10);
        expect(HeadLightUtil.getDecay(defaults.headLightRangeStep))
            .toBeCloseTo(ORDINARY_RANGE_DECAY, 10);
        expect(ORDINARY_POWER_INTENSITY).toBe(4.0);
        expect(ORDINARY_RANGE_DISTANCE).toBe(16);
        expect(ORDINARY_RANGE_DECAY).toBe(0.5);
    });

    it("leaves the lamps room to be turned far past what seeing by takes", () => {
        // The whole of what this change was for: both lights reach well past the ordinary room, so
        // that a room can be lit as an effect rather than only as somewhere to see.
        expect(HeadLightUtil.getIntensity(MAX_ROOM_PREFS_STEP))
            .toBeGreaterThan(3 * ORDINARY_POWER_INTENSITY);
        expect(RoomPrefsUtil.getAmbientIntensity(
            {...defaults, ambientIntensityStep: MAX_ROOM_PREFS_STEP}))
            .toBeGreaterThan(1);
    });

    it("has no fog the camera can reach", () => {
        expect(RoomPrefsUtil.getFogNearDistance(defaults)).toBeGreaterThanOrEqual(CAMERA_FAR_PLANE);
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][defaults.fogColorIndex]).toBe("#000000");
    });

    it("paints its sky in its own air's color", () => {
        // The sky has no default of its own: a room that does not carry one is given its air's
        // color, which for a room that has said nothing at all is the black void past the room it
        // has always had.
        expect(defaults.skyColorIndex).toBe(defaults.fogColorIndex);
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][defaults.skyColorIndex]).toBe("#000000");
    });

    it("shows no clouds, because there is no weather at all", () => {
        // Said with the strength rather than with the color, which is what the move to a palette of
        // the clouds' own forced and what a person reading the sliders would expect anyway. The color
        // waiting behind it is a real cloud color, so turning the strength up gives a cloud rather
        // than a stain.
        expect(RoomPrefsUtil.getCloudOpacity(defaults)).toBe(0);
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.cloudColorIndex])
            .toBe("#ffffff");
    });

    it("stands the room over quiet neutral land", () => {
        // The one default here that is not "as things were", and deliberately: a sky with no clouds
        // is a clear sky, but a sky with no ground is a room hanging in a void — a stronger statement
        // than any weather, and not one an unconfigured room should be making. Dark neutrals are also
        // the one choice that reads correctly against every air a room might pick, since ground
        // darker than the sky above it is what a horizon is.
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.groundColorIndex])
            .toBe("#1a1a1a");
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.groundPeakColorIndex])
            .toBe("#4d4d4d");
        // Coarse enough that a handful of hills stand between the room's edge and the horizon, solid
        // enough to be a country rather than a suggestion of one, and meeting over a hillside rather
        // than at a drawn line — pinned for the reason the cloud settings are, since there is no
        // "as it always was" here.
        expect(RoomPrefsUtil.getGroundScale(defaults)).toBeCloseTo(1.2, 1);
        expect(RoomPrefsUtil.getGroundSolidity(defaults)).toBeGreaterThan(1);
        expect(RoomPrefsUtil.getGroundSoftness(defaults)).toBeCloseTo(0.066, 3);
    });

    it("carries smoke in air there is none of", () => {
        // The smoke defaults to on, and it costs nothing to do so: an unconfigured room's fog is
        // pushed past everything the camera draws, so there is no haze for it to be uneven in. What
        // it buys is that the first room to pull its fog in finds air that already moves.
        expect(RoomPrefsUtil.getFogSmokeAmplitude(defaults)).toBeGreaterThan(0);
        expect(RoomPrefsUtil.getFogSmokeSpeed(defaults)).toBeGreaterThan(0);
        expect(RoomPrefsUtil.getFogNearDistance(defaults)).toBeGreaterThanOrEqual(CAMERA_FAR_PLANE);
    });

    it("sends the smoke off an axis, and gently upward", () => {
        // Rising, as smoke does — and off a bearing that is none of the world's own axes, since air
        // travelling exactly along one reads as a mechanism rather than as a draught.
        const drift = RoomPrefsUtil.getFogSmokeDrift(defaults);
        expect(drift.y).toBeGreaterThan(0);
        expect(Math.abs(drift.x)).toBeGreaterThan(0.01);
        expect(Math.abs(drift.z)).toBeGreaterThan(0.01);
    });

    it("carries the cloud settings the sky was tuned at", () => {
        // Unlike everything else here there is no "as it always was" to fall back on, so these are
        // simply the values the atmosphere was tuned at — pinned so that a change to the curves or
        // the ranges cannot quietly re-weather every room that never asked for anything.
        expect(RoomPrefsUtil.getCloudScale(defaults)).toBeCloseTo(5.3, 1);
        expect(RoomPrefsUtil.getCloudSpeed(defaults)).toBeCloseTo(0.008, 3);
        expect(RoomPrefsUtil.getCloudSoftness(defaults)).toBeCloseTo(0.1, 2);
    });

    it("moves its clouds and its smoke at the speeds they were tuned at, however far the top reaches", () => {
        // Generation writes every setting out in full, so every generated room holds these two
        // steps explicitly — which makes the speed each one names the one point on its curve that
        // can never move. Pinned far more tightly than the rest for that reason: the top of both
        // ranges reaches a long way past them, and a curve reshaped carelessly around the default
        // would quietly re-weather every room ever generated.
        expect(RoomPrefsUtil.getCloudSpeed(defaults)).toBeCloseTo(0.00801942421, 10);
        expect(RoomPrefsUtil.getFogSmokeSpeed(defaults)).toBeCloseTo(0.11723898717, 10);
        // ...and the tops are storms rather than drifts.
        expect(MAX_CLOUD_SPEED).toBeGreaterThan(100 * RoomPrefsUtil.getCloudSpeed(defaults));
        expect(MAX_FOG_SMOKE_SPEED).toBeGreaterThan(100 * RoomPrefsUtil.getFogSmokeSpeed(defaults));
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
        expect(HeadLightUtil.getIntensity(0)).toBe(0);
        expect(HeadLightUtil.getIntensity(MAX_ROOM_PREFS_STEP))
            .toBeGreaterThan(HeadLightUtil.getIntensity(0));
    });

    it("never lets the head lamp grow dimmer as it is turned up", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(HeadLightUtil.getIntensity(high))
                .toBeGreaterThanOrEqual(HeadLightUtil.getIntensity(low));
            expect(HeadLightUtil.getDistance(high))
                .toBeGreaterThanOrEqual(HeadLightUtil.getDistance(low));
            expect(HeadLightUtil.getDecay(high))
                .toBeLessThanOrEqual(HeadLightUtil.getDecay(low));
        }));
    });

    it("gives the head lamp two dials that do not move together", () => {
        // The whole of what separating them bought. Fused, a dim lamp was always a small one and a
        // bright lamp always a far-reaching one, so a soft wash filling the room and a fierce pool a
        // pace across were opposite ends of one dial and neither crossing could be asked for.
        const dimAndWide = HeadLightUtil.getIntensity(10);
        const fierceAndTight = HeadLightUtil.getIntensity(MAX_ROOM_PREFS_STEP);
        expect(dimAndWide).toBeLessThan(fierceAndTight);
        // ...and the reach of each is whatever the *other* dial says, independently of that.
        expect(HeadLightUtil.getDistance(MAX_ROOM_PREFS_STEP))
            .toBeGreaterThan(HeadLightUtil.getDistance(0));
        expect(HeadLightUtil.getDecay(MAX_ROOM_PREFS_STEP))
            .toBeLessThan(HeadLightUtil.getDecay(0));
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

    it("lets the air be made still, and the clouds be faded out entirely", () => {
        // Both bottoms are settings in their own right rather than range artifacts, and neither is
        // expressible on a geometric curve — which is why these two do not use one.
        expect(RoomPrefsUtil.getCloudSpeed({...defaultPrefs, cloudSpeedStep: 0})).toBe(0);
        expect(RoomPrefsUtil.getCloudOpacity({...defaultPrefs, cloudOpacityStep: 0})).toBe(0);
    });

    it("keeps every cloud setting inside its own range, and rising with its step", () => {
        const read = (field: keyof typeof defaultPrefs, step: number) =>
            ({...defaultPrefs, [field]: step});
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(RoomPrefsUtil.getCloudScale(read("cloudScaleStep", high)))
                .toBeGreaterThanOrEqual(
                    RoomPrefsUtil.getCloudScale(read("cloudScaleStep", low)));
            expect(RoomPrefsUtil.getCloudSpeed(read("cloudSpeedStep", high)))
                .toBeGreaterThanOrEqual(
                    RoomPrefsUtil.getCloudSpeed(read("cloudSpeedStep", low)));
            expect(RoomPrefsUtil.getCloudOpacity(read("cloudOpacityStep", high)))
                .toBeGreaterThanOrEqual(
                    RoomPrefsUtil.getCloudOpacity(read("cloudOpacityStep", low)));
            expect(RoomPrefsUtil.getCloudSoftness(read("cloudSoftnessStep", high)))
                .toBeGreaterThanOrEqual(
                    RoomPrefsUtil.getCloudSoftness(read("cloudSoftnessStep", low)));
        }));

        // The scale never reaches zero, and should not: a field of no frequency is a flat sky, which
        // is what picking the cloud color the air already is says.
        expect(RoomPrefsUtil.getCloudScale({...defaultPrefs, cloudScaleStep: 0}))
            .toBeCloseTo(MIN_CLOUD_SCALE, 6);
        expect(RoomPrefsUtil.getCloudScale(
            {...defaultPrefs, cloudScaleStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_CLOUD_SCALE, 6);
        expect(RoomPrefsUtil.getCloudSpeed(
            {...defaultPrefs, cloudSpeedStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_CLOUD_SPEED, 6);
        expect(RoomPrefsUtil.getCloudOpacity(
            {...defaultPrefs, cloudOpacityStep: MAX_ROOM_PREFS_STEP})).toBe(1);
        // Like the scale, the edge width never reaches zero — the tightest a room may ask for is a
        // cut edge, and the shader still holds it open to a pixel so that it cannot shimmer.
        expect(RoomPrefsUtil.getCloudSoftness({...defaultPrefs, cloudSoftnessStep: 0}))
            .toBeCloseTo(MIN_CLOUD_SOFTNESS, 6);
        expect(RoomPrefsUtil.getCloudSoftness(
            {...defaultPrefs, cloudSoftnessStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_CLOUD_SOFTNESS, 6);
    });

    it("keeps the land's coarseness inside its range, and rising with its step", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(RoomPrefsUtil.getGroundScale({...defaultPrefs, groundScaleStep: high}))
                .toBeGreaterThanOrEqual(
                    RoomPrefsUtil.getGroundScale({...defaultPrefs, groundScaleStep: low}));
        }));

        // Never zero, for the reason the clouds' scale is never zero: land of no frequency at all is
        // a flat plain, which is what picking one color for both the low ground and the high says.
        expect(RoomPrefsUtil.getGroundScale({...defaultPrefs, groundScaleStep: 0}))
            .toBeCloseTo(MIN_GROUND_SCALE, 6);
        expect(RoomPrefsUtil.getGroundScale(
            {...defaultPrefs, groundScaleStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_GROUND_SCALE, 6);
    });

    it("keeps the land's solidity and softness inside their ranges, and rising with their steps", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(RoomPrefsUtil.getGroundSolidity({...defaultPrefs, groundSolidityStep: high}))
                .toBeGreaterThanOrEqual(RoomPrefsUtil.getGroundSolidity(
                    {...defaultPrefs, groundSolidityStep: low}));
            expect(RoomPrefsUtil.getGroundSoftness({...defaultPrefs, groundSoftnessStep: high}))
                .toBeGreaterThanOrEqual(RoomPrefsUtil.getGroundSoftness(
                    {...defaultPrefs, groundSoftnessStep: low}));
        }));

        // Neither reaches zero, and neither should. Land of no solidity is land the air has taken,
        // which picking one color for both says better; a slope of no width is an edge the screen
        // cannot draw without crawling, and the shader holds it open to a pixel regardless.
        expect(RoomPrefsUtil.getGroundSolidity({...defaultPrefs, groundSolidityStep: 0}))
            .toBeCloseTo(MIN_GROUND_SOLIDITY, 6);
        expect(RoomPrefsUtil.getGroundSolidity(
            {...defaultPrefs, groundSolidityStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_GROUND_SOLIDITY, 6);
        expect(RoomPrefsUtil.getGroundSoftness({...defaultPrefs, groundSoftnessStep: 0}))
            .toBeCloseTo(MIN_GROUND_SOFTNESS, 6);
        expect(RoomPrefsUtil.getGroundSoftness(
            {...defaultPrefs, groundSoftnessStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_GROUND_SOFTNESS, 6);
    });

    it("keeps every smoke setting inside its own range, and rising with its step", () => {
        fc.assert(fc.property(steps, steps, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(RoomPrefsUtil.getFogSmokeAmplitude({...defaultPrefs, fogSmokeAmplitudeStep: high}))
                .toBeGreaterThanOrEqual(RoomPrefsUtil.getFogSmokeAmplitude(
                    {...defaultPrefs, fogSmokeAmplitudeStep: low}));
            expect(RoomPrefsUtil.getFogSmokeScale({...defaultPrefs, fogSmokeScaleStep: high}))
                .toBeGreaterThanOrEqual(RoomPrefsUtil.getFogSmokeScale(
                    {...defaultPrefs, fogSmokeScaleStep: low}));
            expect(RoomPrefsUtil.getFogSmokeSpeed({...defaultPrefs, fogSmokeSpeedStep: high}))
                .toBeGreaterThanOrEqual(RoomPrefsUtil.getFogSmokeSpeed(
                    {...defaultPrefs, fogSmokeSpeedStep: low}));
        }));

        // Both bottoms are settings in their own right: evenly thick air, and air that hangs still.
        expect(RoomPrefsUtil.getFogSmokeAmplitude({...defaultPrefs, fogSmokeAmplitudeStep: 0}))
            .toBe(0);
        expect(RoomPrefsUtil.getFogSmokeSpeed({...defaultPrefs, fogSmokeSpeedStep: 0})).toBe(0);
        expect(RoomPrefsUtil.getFogSmokeAmplitude(
            {...defaultPrefs, fogSmokeAmplitudeStep: MAX_ROOM_PREFS_STEP})).toBe(1);
        expect(RoomPrefsUtil.getFogSmokeSpeed(
            {...defaultPrefs, fogSmokeSpeedStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_FOG_SMOKE_SPEED, 6);
        // The scale never reaches zero, for the reason none of the scales here does.
        expect(RoomPrefsUtil.getFogSmokeScale({...defaultPrefs, fogSmokeScaleStep: 0}))
            .toBeCloseTo(MIN_FOG_SMOKE_SCALE, 6);
        expect(RoomPrefsUtil.getFogSmokeScale(
            {...defaultPrefs, fogSmokeScaleStep: MAX_ROOM_PREFS_STEP}))
            .toBeCloseTo(MAX_FOG_SMOKE_SCALE, 6);
    });

    it("points the smoke somewhere, whatever the two steps say", () => {
        // The direction and the speed have to stay independent, so that a steeply rising smoke
        // travels neither faster nor slower than a level one. That holds only while this is a unit
        // vector, which is the one thing every pair of steps must produce.
        fc.assert(fc.property(steps, steps, (drift, rise) => {
            const d = RoomPrefsUtil.getFogSmokeDrift(
                {...defaultPrefs, fogSmokeDriftStep: drift, fogSmokeRiseStep: rise});
            expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
        }));

        // Its middle is air travelling flat, which is why this step is centred rather than starting
        // at nothing — and its ends are smoke climbing and dry ice pouring down.
        const level = RoomPrefsUtil.getFogSmokeDrift(
            {...defaultPrefs, fogSmokeRiseStep: Math.round(MAX_ROOM_PREFS_STEP / 2)});
        expect(level.y).toBeCloseTo(0, 1);
        expect(RoomPrefsUtil.getFogSmokeDrift({...defaultPrefs, fogSmokeRiseStep: 0}).y).toBe(-1);
        expect(RoomPrefsUtil.getFogSmokeDrift(
            {...defaultPrefs, fogSmokeRiseStep: MAX_ROOM_PREFS_STEP}).y).toBe(1);
    });
});

const defaultPrefs = RoomPrefsUtil.decode("");


describe("the palettes a room's lighting is drawn from", () => {
    it("starts each with the entry that changes nothing", () => {
        // Load-bearing: index 0 is what an unconfigured room reads back, so white light and a black
        // void are what "nobody has said anything" has to mean.
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][0]).toBe("#ffffff");
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][0]).toBe("#000000");
    });

    it("offers no light that is merely a dimmed one", () => {
        // Every entry sits at the top of the brightness range, so what is picked from this set is a
        // light's color and never how much of it there is — that is the strength beside it, in all
        // three of the places the set is read. A darkened entry is that dial spelled a second time,
        // and it is the one way somebody could install a lamp expecting to light a room and end up
        // with a fitting that gives nothing back.
        for (const hex of ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME])
        {
            const rgb = ColorUtil.hexToRGB(hex);
            expect(Math.max(rgb.x, rgb.y, rgb.z)).toBe(255);
        }
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

// How many characters a room's string ran to before its sky had a color of its own — everything up
// to and including the head lamp's range.
const PRE_SKY_PREFS_LENGTH = 23;

describe("a sky with a color of its own", () => {
    it("gives a room stored before it could choose a sky the sky it already had", () => {
        // Such a room's string stops short of the sky's character, and its sky was painted in its
        // air's color. Reading it back any other way would repaint the sky of every room that ever
        // chose a fog.
        const fogColors = fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME) - 1});
        fc.assert(fc.property(fogColors, (fogColorIndex) => {
            const stored = RoomPrefsUtil.encode({...defaultPrefs, fogColorIndex, skyColorIndex: 0})
                .substring(0, PRE_SKY_PREFS_LENGTH);
            expect(RoomPrefsUtil.decode(stored).skyColorIndex).toBe(fogColorIndex);
        }));
    });

    it("keeps the sky it was given once it carries one, whatever the air is", () => {
        // Only a room that has never said follows its air; one that has chosen a sky keeps it
        // however its fog is changed afterwards.
        const decoded = RoomPrefsUtil.decode(
            RoomPrefsUtil.encode({...defaultPrefs, fogColorIndex: 12, skyColorIndex: 60}));
        expect(decoded.skyColorIndex).toBe(60);
        expect(decoded.fogColorIndex).toBe(12);
    });
});
