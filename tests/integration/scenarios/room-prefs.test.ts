/**
 * Scenario tests: room prefs — atmosphere (room light, head lamp, air) and a hub's join priority.
 * Covers round-trips; an empty string decoding to the pre-prefs look (so existing rooms need no
 * migration); total decoding; and fog distances always leaving a span.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import RoomPrefsUtil, { MAX_AMBIENT_INTENSITY, MAX_CLOUD_SCALE, MAX_CLOUD_SOFTNESS, MAX_CLOUD_SPEED,
    MAX_FOG_DISTANCE, MAX_FOG_SMOKE_SCALE, MAX_FOG_SMOKE_SPEED, MAX_GROUND_SCALE,
    MAX_GROUND_SOFTNESS, MAX_GROUND_SOLIDITY, MAX_ROOM_INITIAL_JOIN_PRIORITY, MAX_ROOM_PREFS_STEP,
    MIN_CLOUD_SCALE, MIN_CLOUD_SOFTNESS, MIN_FOG_SMOKE_SCALE, MIN_GROUND_SCALE, MIN_GROUND_SOFTNESS,
    MIN_GROUND_SOLIDITY }
    from "../../../src/shared/room/util/roomPrefsUtil";
import RoomPrefs from "../../../src/shared/room/types/roomPrefs";
import HeadLightUtil, { ORDINARY_POWER_INTENSITY, ORDINARY_RANGE_DECAY, ORDINARY_RANGE_DISTANCE }
    from "../../../src/shared/graphics/light/util/headLightUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME,
    SCENERY_COLOR_PALETTE_NAME } from "../../../src/shared/system/sharedConstants";

// The eye camera's far plane (the renderer's, written out); the default fog must lie beyond it.
const CAMERA_FAR_PLANE = 45;

// Every encodable character, so decoding is exercised over its whole domain.
const prefsStrings = fc.array(fc.integer({min: 33, max: 126}), {maxLength: 34})
    .map(codes => codes.map(code => String.fromCharCode(code)).join(""));

// Any string: a stored value is whatever the document holds, not what this version wrote.
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
        initialJoinPriority: fc.integer({min: 0, max: MAX_ROOM_INITIAL_JOIN_PRIORITY}),
    });
}

describe("room prefs encoding", () => {
    it("brings a room's settings back exactly as they were stored", () => {
        fc.assert(fc.property(arbitraryPrefs(), (prefs) => {
            expect(RoomPrefsUtil.decode(RoomPrefsUtil.encode(prefs))).toEqual(prefs);
        }));
    });

    it("stores only what a room can be read back from", () => {
        // Canonicalizing is the server's whole validation (see ServerRoomManager.changeRoomPrefs), so it
        // must be idempotent, or a room drifts on each save.
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
        // The shader divides by the fog span, so it must never be zero (defaults included).
        fc.assert(fc.property(prefsStrings, (raw) => {
            const prefs = RoomPrefsUtil.decode(raw);
            expect(RoomPrefsUtil.getFogFarDistance(prefs))
                .toBeGreaterThan(RoomPrefsUtil.getFogNearDistance(prefs));
        }));
    });
});

describe("a room that has said nothing", () => {
    // An empty string (every room before prefs existed) must decode to exactly how those rooms looked.
    const defaults = RoomPrefsUtil.decode("");

    it("is lit in plain white", () => {
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][defaults.ambientColorIndex])
            .toBe("#ffffff");
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][defaults.headLightColorIndex])
            .toBe("#ffffff");
    });

    it("is filled at exactly the ambient strength it always had", () => {
        // The ambient default predates prefs, so it reveals drift; compared with a tolerance since it now
        // passes through a curve.
        expect(RoomPrefsUtil.getAmbientIntensity(defaults)).toBeCloseTo(0.15, 10);
    });

    it("carries the head lamp at the strength it always had", () => {
        // The range's top is now an effect, so the ordinary head lamp sits below it; these pin that lamp.
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
        // Both lights reach well past an ordinary room's needs, for effect lighting.
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
        // The sky has no default: without one it takes the fog color (a black void when unconfigured).
        expect(defaults.skyColorIndex).toBe(defaults.fogColorIndex);
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][defaults.skyColorIndex]).toBe("#000000");
    });

    it("shows no clouds, because there is no weather at all", () => {
        // Clouds are off via zero strength, not via color; the color behind it is a real cloud color.
        expect(RoomPrefsUtil.getCloudOpacity(defaults)).toBe(0);
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.cloudColorIndex])
            .toBe("#ffffff");
    });

    it("stands the room over quiet neutral land", () => {
        // Unlike the rest, the ground default isn't "as before": a groundless sky reads as a void, and dark
        // neutrals sit correctly under any air.
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.groundColorIndex])
            .toBe("#1a1a1a");
        expect(ColorPaletteMap[SCENERY_COLOR_PALETTE_NAME][defaults.groundPeakColorIndex])
            .toBe("#4d4d4d");
        // A few solid hills before the horizon, meeting on a hillside; pinned (no prior look to match).
        expect(RoomPrefsUtil.getGroundScale(defaults)).toBeCloseTo(1.2, 1);
        expect(RoomPrefsUtil.getGroundSolidity(defaults)).toBeGreaterThan(1);
        expect(RoomPrefsUtil.getGroundSoftness(defaults)).toBeCloseTo(0.066, 3);
    });

    it("carries smoke in air there is none of", () => {
        // Smoke defaults on at no cost (the default fog is past the far plane), so pulled-in fog already moves.
        expect(RoomPrefsUtil.getFogSmokeAmplitude(defaults)).toBeGreaterThan(0);
        expect(RoomPrefsUtil.getFogSmokeSpeed(defaults)).toBeGreaterThan(0);
        expect(RoomPrefsUtil.getFogNearDistance(defaults)).toBeGreaterThanOrEqual(CAMERA_FAR_PLANE);
    });

    it("sends the smoke off an axis, and gently upward", () => {
        // Rising, off every world axis (axis-aligned drift looks mechanical).
        const drift = RoomPrefsUtil.getFogSmokeDrift(defaults);
        expect(drift.y).toBeGreaterThan(0);
        expect(Math.abs(drift.x)).toBeGreaterThan(0.01);
        expect(Math.abs(drift.z)).toBeGreaterThan(0.01);
    });

    it("carries the cloud settings the sky was tuned at", () => {
        // No prior look to match, so the tuned values are pinned against curve or range changes.
        expect(RoomPrefsUtil.getCloudScale(defaults)).toBeCloseTo(5.3, 1);
        expect(RoomPrefsUtil.getCloudSpeed(defaults)).toBeCloseTo(0.008, 3);
        expect(RoomPrefsUtil.getCloudSoftness(defaults)).toBeCloseTo(0.1, 2);
    });

    it("moves its clouds and its smoke at the speeds they were tuned at, however far the top reaches", () => {
        // Generation writes these steps explicitly, so their speeds must never move; pinned tightly.
        expect(RoomPrefsUtil.getCloudSpeed(defaults)).toBeCloseTo(0.00801942421, 10);
        expect(RoomPrefsUtil.getFogSmokeSpeed(defaults)).toBeCloseTo(0.11723898717, 10);
        // ...and the tops are storms rather than drifts.
        expect(MAX_CLOUD_SPEED).toBeGreaterThan(100 * RoomPrefsUtil.getCloudSpeed(defaults));
        expect(MAX_FOG_SMOKE_SPEED).toBeGreaterThan(100 * RoomPrefsUtil.getFogSmokeSpeed(defaults));
    });

    it("is what a shorter string from some other version decodes to as well", () => {
        // Missing trailing fields fall back to defaults, so the format extends without versioning.
        const partial = RoomPrefsUtil.decode(RoomPrefsUtil.encode(defaults).substring(0, 2));
        expect(partial).toEqual(defaults);
    });

    it("is what generation writes out explicitly", () => {
        // Generation decides, here by writing the default explicitly (see @.claude/rules/room-generation.md).
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
        // Separate intensity and range allow both a dim wide wash and a bright tight pool.
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
        // Both zero steps are real settings that no geometric curve can express, hence no curve here.
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

        // Scale never reaches zero (a flat sky is expressed by matching the cloud color to the air).
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
        // Edge width never reaches zero; the shader keeps at least a pixel to prevent shimmer.
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

        // Never zero: flat land is expressed by one color for low and high ground.
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

        // Neither reaches zero: no solidity is expressed by matching colors, and the shader keeps slopes
        // at least a pixel wide.
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
        // The direction must be a unit vector for every step pair, so rise doesn't change speed.
        fc.assert(fc.property(steps, steps, (drift, rise) => {
            const d = RoomPrefsUtil.getFogSmokeDrift(
                {...defaultPrefs, fogSmokeDriftStep: drift, fogSmokeRiseStep: rise});
            expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
        }));

        // Centered: the middle is level drift, the ends rising smoke and pouring dry ice.
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
        // Index 0 is the unconfigured default: white light and a black void.
        expect(ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][0]).toBe("#ffffff");
        expect(ColorPaletteMap[FOG_COLOR_PALETTE_NAME][0]).toBe("#000000");
    });

    it("offers no light that is merely a dimmed one", () => {
        // Every entry is full brightness, since strength is a separate dial (a dark entry could make a lamp
        // that gives no light).
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

// String length before the sky had its own color (through the head lamp's range).
const PRE_SKY_PREFS_LENGTH = 23;

describe("a sky with a color of its own", () => {
    it("gives a room stored before it could choose a sky the sky it already had", () => {
        // Such strings end before the sky field, and their sky was the fog color; reading them otherwise
        // would repaint every such room's sky.
        const fogColors = fc.integer({min: 0,
            max: ColorUtil.getPaletteSize(FOG_COLOR_PALETTE_NAME) - 1});
        fc.assert(fc.property(fogColors, (fogColorIndex) => {
            const stored = RoomPrefsUtil.encode({...defaultPrefs, fogColorIndex, skyColorIndex: 0})
                .substring(0, PRE_SKY_PREFS_LENGTH);
            expect(RoomPrefsUtil.decode(stored).skyColorIndex).toBe(fogColorIndex);
        }));
    });

    it("keeps the sky it was given once it carries one, whatever the air is", () => {
        // Only an unset sky follows the fog; a chosen sky persists through fog changes.
        const decoded = RoomPrefsUtil.decode(
            RoomPrefsUtil.encode({...defaultPrefs, fogColorIndex: 12, skyColorIndex: 60}));
        expect(decoded.skyColorIndex).toBe(60);
        expect(decoded.fogColorIndex).toBe(12);
    });
});

// String length before hubs could be ordered (through the sky color).
const PRE_JOIN_PRIORITY_PREFS_LENGTH = 24;

describe("a hub's place in the order visitors fill hubs in", () => {
    it("puts a hub stored before there was an order in the middle of it", () => {
        // Every hub predates the setting, so they must all read back as one undecided group rather
        // than as hubs their admins put first.
        const stored = RoomPrefsUtil.encode(defaultPrefs)
            .substring(0, PRE_JOIN_PRIORITY_PREFS_LENGTH);
        expect(RoomPrefsUtil.decode(stored).initialJoinPriority)
            .toBe(RoomPrefsUtil.decode("").initialJoinPriority);
    });

    it("leaves room to promote a hub as well as demote one", () => {
        const defaultPriority = RoomPrefsUtil.decode("").initialJoinPriority;
        expect(defaultPriority).toBeGreaterThan(0);
        expect(defaultPriority).toBeLessThan(MAX_ROOM_INITIAL_JOIN_PRIORITY);
    });

    it("reads a place inside the order out of any stored character", () => {
        // The field shares the prefs alphabet, which addresses far more than the order has places.
        fc.assert(fc.property(prefsStrings, (raw) => {
            const priority = RoomPrefsUtil.decode(raw).initialJoinPriority;
            expect(Number.isInteger(priority)).toBe(true);
            expect(priority).toBeGreaterThanOrEqual(0);
            expect(priority).toBeLessThanOrEqual(MAX_ROOM_INITIAL_JOIN_PRIORITY);
        }));
    });
});
