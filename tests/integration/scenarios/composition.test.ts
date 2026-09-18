/**
 * Scenario tests: player mesh composition (InstancedMeshComposition). The encoded string is relayed
 * between clients, so decoding treats it as untrusted.
 * Covers: codec round-trip and robustness, owner-only permissions, oversized truncation, relay, and
 * persistence across reconnects and room switches.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import * as THREE from "three";
import { runScenario } from "../helpers/scenarioRunner";
import { getPendingSignals } from "../helpers/invariants";
import { regularRoom, namedUser, usersInRoom } from "../helpers/scenarioPresets";
import {
    encodePlayerComposition, decodePlayerComposition, playerCodecPrefix,
    PLAYER_CODEC_TYPE, PLAYER_CODEC_VERSION,
    encodeDoorComposition, decodeDoorComposition, doorCodecPrefix, DOOR_CODEC_TYPE,
    generateDefaultDoorComposition,
} from "../helpers/composition";
import { PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import { DoorCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import DoorCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";

import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { InstancedMeshCompositionBuilderMap } from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCompositionBuilderMap";
import { InstancedMeshCompositionCodecMap } from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import PreEncodedCompositionStringMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionStringMap";
import InstancedMeshCapacityMap from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCapacityMap";
import InstancedMeshIdMap from "../../../src/shared/graphics/mesh/maps/instancedMeshIdMap";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import DirUtil from "../../../src/shared/math/util/dirUtil";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import { DIR_VEC_BY_CODE,
    OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";

const COMPOSITION_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;

// Asserts a decoded composition is drawable (the part count varies with variants, so isn't checked).
function expectRenderableBody(
    params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]): void
{
    expect(parts.length).toBeGreaterThan(0);

    // Every part must name a mesh that was sized for it, or it goes undrawn.
    for (const part of parts)
    {
        expect(InstancedMeshCapacityMap).toHaveProperty(
            InstancedMeshIdMap.getInstancedMeshId(part.geometryId, part.materialId));
        for (const vec of [part.offset, part.dir, part.scale])
        {
            expect(Number.isFinite(vec.x)).toBe(true);
            expect(Number.isFinite(vec.y)).toBe(true);
            expect(Number.isFinite(vec.z)).toBe(true);
        }
    }
}

// Maps each entry of the composition's `types` to the body-part builder it selects a variant of.
const BUILDER_TYPE_BY_PART: {[part: string]: string} = {
    head: "PlayerHead",
    ear: "PlayerEar",
    hat: "PlayerHat",
    torso: "PlayerTorso",
    arm: "PlayerArm",
    bottom: "PlayerBottom",
};

describe("player mesh composition", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Codec: round-trip & determinism ───────────────────────────────

    it("a composition survives an encode/decode round-trip", () => {
        const {params, parts} = PlayerCompositionCodec.getRandomComposition(12345);
        const encoded = playerCodecPrefix() + PlayerCompositionCodec.encode(params, parts);

        const decoded = decodePlayerComposition(encoded);

        expect(decoded.params.types).toEqual(params.types);
        expect(decoded.params.colors).toEqual(params.colors);
        expect(decoded.parts.length).toBe(parts.length);
    });

    it("the same seed always yields the same composition", () => {
        const a = PlayerCompositionCodec.getRandomComposition(777);
        const b = PlayerCompositionCodec.getRandomComposition(777);
        const c = PlayerCompositionCodec.getRandomComposition(778);

        expect(PlayerCompositionCodec.encode(a.params, a.parts))
            .toBe(PlayerCompositionCodec.encode(b.params, b.parts));
        expect(PlayerCompositionCodec.encode(a.params, a.parts))
            .not.toBe(PlayerCompositionCodec.encode(c.params, c.parts));
    });

    it("decoding is idempotent — re-encoding a decoded composition reproduces the string", () => {
        fc.assert(fc.property(fc.integer(), (seed) => {
            const encoded = encodePlayerComposition(seed);
            const decoded = decodePlayerComposition(encoded);
            const reEncoded = playerCodecPrefix()
                + PlayerCompositionCodec.encode(decoded.params, decoded.parts);
            expect(reEncoded).toBe(encoded);
        }), {numRuns: 100});
    });

    // ─── Codec: robustness against untrusted input ─────────────────────

    it("decoding an arbitrary string never throws and still yields a full body", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            const decoded = decodePlayerComposition(playerCodecPrefix() + garbage);
            expectRenderableBody(decoded.params, decoded.parts);
        }), {numRuns: 500});
    });

    it("decoded params are canonical, so a hostile string cannot smuggle an out-of-range part type", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            const decoded = decodePlayerComposition(playerCodecPrefix() + garbage);
            const types = decoded.params.types as {[part: string]: number};
            for (const part of Object.keys(types))
            {
                // A decoded part type must name an existing body-part variant.
                const builderType = `${BUILDER_TYPE_BY_PART[part]}_${types[part]}`;
                expect(InstancedMeshCompositionBuilderMap[builderType],
                    `no builder registered for "${builderType}"`).toBeDefined();
            }
        }), {numRuns: 500});
    });

    it("part types far outside the valid range decode to a renderable body", () => {
        // "z" decodes to a raw part type of 89 — no such body-part variant exists.
        const decoded = decodePlayerComposition(playerCodecPrefix() + "zzzzzz" + "aaaaaa");
        expectRenderableBody(decoded.params, decoded.parts);
    });

    it("a truncated composition decodes to a renderable body", () => {
        for (let length = 0; length < 12; ++length)
        {
            const partial = encodePlayerComposition(42).substring(0, 2 + length);
            const decoded = decodePlayerComposition(partial);
            expectRenderableBody(decoded.params, decoded.parts);
        }
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("a user can set his/her own player's composition", async () => {
        const composition = encodePlayerComposition(1);
        await runScenario({
            name: "own composition",
            rooms: [regularRoom("comp-room")],
            users: usersInRoom(2, "comp-room"),
            actions: [
                { type: "setPlayerComposition", userIndex: 0, seed: 1 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id);
                expect(obj!.metadata[COMPOSITION_KEY]?.str).toBe(composition);
            },
        });
    });

    it("a user cannot set another player's composition", async () => {
        await runScenario({
            name: "foreign composition rejected",
            rooms: [regularRoom("comp-perm")],
            users: usersInRoom(2, "comp-perm"),
            actions: [
                // User 0 tries to rewrite user 1's appearance.
                { type: "setObjectMetadata", userIndex: 0, targetUserIndex: 1,
                    metadataKey: COMPOSITION_KEY, metadataValue: encodePlayerComposition(2) },
            ],
            assertions: ({ users, harness }) => {
                const victim = harness.getPlayerObject(users[1].user.id);
                expect(victim!.metadata[COMPOSITION_KEY]).toBeUndefined();
                // The rejection is corrected back to the sender.
                const reverts = getPendingSignals(users[0], "setObjectMetadataSignal");
                expect(reverts.length).toBeGreaterThan(0);
            },
        });
    });

    it("a player rejects metadata keys outside the allowed set", async () => {
        await runScenario({
            name: "disallowed metadata key",
            rooms: [regularRoom("comp-key")],
            users: usersInRoom(1, "comp-key"),
            actions: [
                { type: "setObjectMetadata", userIndex: 0,
                    metadataKey: ObjectMetadataKeyEnumMap.ImagePath, metadataValue: "http://evil/x.webp" },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id);
                expect(obj!.metadata[ObjectMetadataKeyEnumMap.ImagePath]).toBeUndefined();
            },
        });
    });

    // ─── Preprocessing ─────────────────────────────────────────────────

    it("an oversized composition is truncated by the server", async () => {
        const oversized = playerCodecPrefix()
            + "a".repeat(OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH * 2);
        await runScenario({
            name: "oversized composition",
            rooms: [regularRoom("comp-size")],
            users: usersInRoom(1, "comp-size"),
            actions: [
                { type: "setPlayerComposition", userIndex: 0, raw: oversized },
            ],
            assertions: ({ users, harness }) => {
                const stored = harness.getPlayerObject(users[0].user.id)!.metadata[COMPOSITION_KEY]!.str;
                expect(stored.length).toBe(OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH);
                // Whatever survives truncation must still decode into a renderable body.
                const decoded = decodePlayerComposition(stored);
                expectRenderableBody(decoded.params, decoded.parts);
            },
        });
    });

    // ─── Relay ─────────────────────────────────────────────────────────

    it("a composition change is relayed to the other participants", async () => {
        await runScenario({
            name: "composition relay",
            rooms: [regularRoom("comp-relay")],
            users: usersInRoom(3, "comp-relay"),
            actions: [
                { type: "setPlayerComposition", userIndex: 0, seed: 3 },
            ],
            assertions: ({ users }) => {
                expect(getPendingSignals(users[1], "setObjectMetadataSignal").length).toBeGreaterThan(0);
                expect(getPendingSignals(users[2], "setObjectMetadataSignal").length).toBeGreaterThan(0);
            },
        });
    });

    it("a hostile composition is relayed but still decodes to a body on the receiving side", async () => {
        // The server relays the string verbatim, so every other client decodes whatever was sent.
        const hostile = playerCodecPrefix() + "~~~~~~~~~~~~";
        await runScenario({
            name: "hostile composition relay",
            rooms: [regularRoom("comp-hostile")],
            users: usersInRoom(2, "comp-hostile"),
            actions: [
                { type: "setPlayerComposition", userIndex: 0, raw: hostile },
            ],
            assertions: ({ users, harness }) => {
                const stored = harness.getPlayerObject(users[0].user.id)!.metadata[COMPOSITION_KEY]!.str;
                const decoded = decodePlayerComposition(stored);
                expectRenderableBody(decoded.params, decoded.parts);
            },
        });
    });

    // ─── Persistence ───────────────────────────────────────────────────

    it("a composition set in-session survives reconnection", async () => {
        const composition = encodePlayerComposition(5);
        await runScenario({
            name: "composition survives reconnect",
            rooms: [regularRoom("comp-recon")],
            users: [namedUser("comp-user", "comp-recon")],
            actions: [
                { type: "setPlayerComposition", userIndex: 0, seed: 5 },
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("comp-user");
                expect(obj!.metadata[COMPOSITION_KEY]?.str).toBe(composition);
            },
        });
    });

    it("a restored composition survives a room switch", async () => {
        const composition = encodePlayerComposition(6);
        await runScenario({
            name: "composition survives room switch",
            rooms: [regularRoom("comp-from"), regularRoom("comp-to")],
            users: [namedUser("switch-user", "comp-from", {
                playerMetadata: { [String(COMPOSITION_KEY)]: composition },
            })],
            actions: [
                { type: "requestRoomChange", userIndex: 0, roomID: "comp-to" },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("switch-user");
                expect(obj!.metadata[COMPOSITION_KEY]?.str).toBe(composition);
            },
        });
    });

    // ─── Config coherence ──────────────────────────────────────────────

    it("the player object is configured with the codec these tests encode against", () => {
        // Guards against the object config drifting away from the wire format the clients speak.
        const prefix = playerCodecPrefix();
        const encoded = encodePlayerComposition(0);
        expect(encoded.startsWith(prefix)).toBe(true);
        expect(PLAYER_CODEC_TYPE).toBeGreaterThanOrEqual(0);
        expect(PLAYER_CODEC_VERSION).toBeGreaterThanOrEqual(0);
    });
});

/**
 * Door appearance: encoded like a player's, but derived for the door, so it's identical for every
 * player and every session.
 */
describe("door mesh composition", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Codec: round-trip & determinism ───────────────────────────────

    it("a composition survives an encode/decode round-trip", () => {
        const {params, parts} = DoorCompositionCodec.getRandomComposition(12345);
        const encoded = doorCodecPrefix() + DoorCompositionCodec.encode(params, parts);

        const decoded = decodeDoorComposition(encoded);

        expect(decoded.params.colors).toEqual(params.colors);
        expect(decoded.parts.length).toBe(parts.length);
    });

    it("the same seed always yields the same door", () => {
        const a = DoorCompositionCodec.getRandomComposition(777);
        const b = DoorCompositionCodec.getRandomComposition(777);

        expect(DoorCompositionCodec.encode(a.params, a.parts))
            .toBe(DoorCompositionCodec.encode(b.params, b.parts));
    });

    it("decoding is idempotent — re-encoding a decoded door reproduces the string", () => {
        fc.assert(fc.property(fc.integer(), (seed) => {
            const encoded = encodeDoorComposition(seed);
            const decoded = decodeDoorComposition(encoded);
            const reEncoded = doorCodecPrefix()
                + DoorCompositionCodec.encode(decoded.params, decoded.parts);
            expect(reEncoded).toBe(encoded);
        }), {numRuns: 100});
    });

    it("every authored preset survives the palette the codec quantizes to", () => {
        // Preset colors must land exactly on palette entries, or they decode to a different color.
        for (const preset of DoorCompositionConstants.presets)
        {
            for (const color of Object.values(preset))
            {
                expect(ColorUtil.paletteIndexToRGB("Timber",
                    ColorUtil.rgbToPaletteIndex("Timber", color))).toEqual(color);
            }
        }
    });

    it("every palette round-trips its own colors, and none outgrows what can name it", () => {
        // Each palette must fit the one-visible-ASCII-char encoding and round-trip every color.
        for (const paletteName of Object.keys(ColorPaletteMap))
        {
            const paletteSize = ColorUtil.getPaletteSize(paletteName);
            expect(paletteSize).toBeGreaterThan(0);
            expect(paletteSize).toBeLessThanOrEqual(94);

            for (let index = 0; index < paletteSize; ++index)
            {
                const color = ColorUtil.paletteIndexToRGB(paletteName, index);
                expect(ColorUtil.rgbToPaletteIndex(paletteName, color)).toBe(index);
            }
        }
    });

    // ─── Codec: robustness against untrusted input ─────────────────────

    it("decoding an arbitrary string never throws and still yields a drawable door", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            const decoded = decodeDoorComposition(doorCodecPrefix() + garbage);
            expectRenderableBody(decoded.params, decoded.parts);
            expectMouldedParts(decoded.parts);
        }), {numRuns: 500});
    });

    it("a truncated composition decodes to a drawable door", () => {
        for (let length = 0; length < 6; ++length)
        {
            const partial = encodeDoorComposition(42).substring(0, 2 + length);
            const decoded = decodeDoorComposition(partial);
            expectRenderableBody(decoded.params, decoded.parts);
            expectMouldedParts(decoded.parts);
        }
    });

    // ─── The appearance a door falls back on ───────────────────────────

    it("a door's default appearance depends on where it stands, not on who is looking at it", () => {
        // Derived from the room and object only (not the viewing user), so everyone sees the same door.
        const a = generateDefaultDoorComposition("room-a", ENTRANCE_DOOR_OBJECT_ID);
        const b = generateDefaultDoorComposition("room-a", ENTRANCE_DOOR_OBJECT_ID);
        expect(b.params.colors).toEqual(a.params.colors);

        // Across a spread of rooms, the doors must not all come out the same.
        const finishes = new Set<string>();
        for (let i = 0; i < 40; ++i)
        {
            const {params, parts} = generateDefaultDoorComposition(`room-${i}`, ENTRANCE_DOOR_OBJECT_ID);
            finishes.add(DoorCompositionCodec.encode(params, parts));
        }
        expect(finishes.size).toBeGreaterThan(1);
    });

    it("a door's default appearance is one of the authored presets", () => {
        for (let i = 0; i < 40; ++i)
        {
            const {params} = generateDefaultDoorComposition(`room-${i}`, ENTRANCE_DOOR_OBJECT_ID);
            expect(DoorCompositionConstants.presets).toContainEqual(params.colors);
        }
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("a door is finished by an admin in a hub, and by nobody else anywhere", () => {
        // Door appearance is admin world-building: hubs only, never a Regular room's own door.
        const canReskin = (userType: number, roomType: number) =>
            DoorObjectTypeConfig.canUserSetObjectMetadata(
                {id: "u", userType} as any, {roomType} as any, {} as any,
                {metadataKey: COMPOSITION_KEY, metadataValue: encodeDoorComposition(1)} as any);

        expect(canReskin(UserTypeEnumMap.Admin, RoomTypeEnumMap.Hub)).toBe(true);
        expect(canReskin(UserTypeEnumMap.Admin, RoomTypeEnumMap.Regular)).toBe(false);
        expect(canReskin(UserTypeEnumMap.Member, RoomTypeEnumMap.Hub)).toBe(false);
        expect(canReskin(UserTypeEnumMap.Guest, RoomTypeEnumMap.Hub)).toBe(false);
    });

    // ─── Config coherence ──────────────────────────────────────────────

    it("the door object is configured with the codec these tests encode against", () => {
        const encoded = encodeDoorComposition(0);
        expect(encoded.startsWith(doorCodecPrefix())).toBe(true);
        // A door and a player must not claim the same codec, or one would decode the other's string.
        expect(DOOR_CODEC_TYPE).not.toBe(PLAYER_CODEC_TYPE);
    });

    it("every part of a door is drawn by a mesh that was sized for it", () => {
        const {params, parts} = DoorCompositionCodec.getRandomComposition(1);
        // Regions are layered back to front to avoid z-fighting (see DoorCompositionConstants).
        expectRenderableBody(params, parts);
        expectMouldedParts(parts);
        const reliefs = parts.map((part) => Math.abs(part.offset.z));
        expect(Math.min(...reliefs)).toBeGreaterThan(0);
        expect(new Set(reliefs).size).toBeGreaterThan(1);
    });
});

// Every part must carry the moulding inputs the wood material reads.
function expectMouldedParts(parts: InstancedMeshCompositionPart[]): void
{
    for (const part of parts)
    {
        expect(part.mouldingThickness).toBeGreaterThan(0);
        expect(typeof part.mouldingIsConvex).toBe("boolean");
        for (const channel of [part.mouldingColor.x, part.mouldingColor.y, part.mouldingColor.z])
        {
            expect(Number.isFinite(channel)).toBe(true);
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(255);
        }
    }
}

/**
 * An indexed composition names a build-time entry in PreEncodedCompositionStringMap and decodes as that
 * entry's codec. Decoding must be total: an index naming nothing still leaves the object drawable.
 * Reached through the codec map, as in production, to avoid an import cycle.
 */
describe("indexed mesh composition", () => {
    const IndexedCodec = InstancedMeshCompositionCodecMap[
        InstancedMeshCompositionCodecTypeEnumMap.Indexed];

    // The index is written as two base-94 digits, so this is the last position one can name.
    const MAX_COMPOSITION_INDEX = 94 * 94 - 1;

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    function indexedPrefix(codecVersion: number = 0): string
    {
        return StringUtil.convertRawNumberToVisibleASCII(
            InstancedMeshCompositionCodecTypeEnumMap.Indexed)
            + StringUtil.convertRawNumberToVisibleASCII(codecVersion);
    }

    function decodeIndexed(str: string):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
    {
        const params: InstancedMeshCompositionParams = {};
        const parts: InstancedMeshCompositionPart[] = [];
        IndexedCodec.decode(str, params, parts);
        return {params, parts};
    }

    // ─── What it stores ────────────────────────────────────────────────

    it("costs the same whatever it names, and whatever it is handed", () => {
        // Its size matters: the string is stored once per look-alike object.
        const first = IndexedCodec.encode({compositionIndex: 0}, []);
        const last = IndexedCodec.encode({compositionIndex: MAX_COMPOSITION_INDEX}, []);
        expect(last.length).toBe(first.length);

        // Parts belong to the table, so passing some doesn't change the encoding.
        const {parts} = PlayerCompositionCodec.getRandomComposition(1);
        expect(IndexedCodec.encode({compositionIndex: 0}, parts).length).toBe(first.length);
    });

    it("an index survives the round trip", () => {
        fc.assert(fc.property(fc.integer({min: 0, max: MAX_COMPOSITION_INDEX}), (index) => {
            const encoded = indexedPrefix() + IndexedCodec.encode({compositionIndex: index}, []);
            expect(decodeIndexed(encoded).params.compositionIndex).toBe(index);
        }), {numRuns: 200});
    });

    // ─── Robustness against untrusted input ────────────────────────────

    it("decoding an arbitrary string never throws", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            expect(() => decodeIndexed(indexedPrefix() + garbage)).not.toThrow();
        }), {numRuns: 500});
    });

    it("an index naming no composition degrades rather than throwing", () => {
        // Nothing guarantees the table still holds the position an old object was stored against.
        const encoded = indexedPrefix()
            + IndexedCodec.encode({compositionIndex: MAX_COMPOSITION_INDEX}, []);
        const decoded = decodeIndexed(encoded);
        expect(decoded.params.compositionIndex).toBe(MAX_COMPOSITION_INDEX);
        expect(Array.isArray(decoded.parts)).toBe(true);
    });

    it("no pre-encoded composition names the indexed codec itself", () => {
        // Such an entry would send the router back through itself without end.
        for (const preEncoded of PreEncodedCompositionStringMap)
        {
            expect(StringUtil.convertVisibleASCIIToRawNumber(preEncoded, 0))
                .not.toBe(InstancedMeshCompositionCodecTypeEnumMap.Indexed);
        }
    });

    // ─── The generated table ───────────────────────────────────────────

    it("every pre-encoded composition decodes to parts the renderer can draw", () => {
        // An empty (not yet built) table would make every indexed object draw nothing.
        for (let index = 0; index < PreEncodedCompositionStringMap.length; ++index)
        {
            const encoded = indexedPrefix() + IndexedCodec.encode({compositionIndex: index}, []);
            const {parts} = decodeIndexed(encoded);
            expect(parts.length).toBeGreaterThan(0);
            for (const part of parts)
            {
                expect(typeof part.geometryId).toBe("string");
                expect(typeof part.materialId).toBe("string");
                for (const vec of [part.offset, part.dir, part.scale])
                {
                    expect(Number.isFinite(vec.x)).toBe(true);
                    expect(Number.isFinite(vec.y)).toBe(true);
                    expect(Number.isFinite(vec.z)).toBe(true);
                }
            }
        }
    });
});

// ─── How a part is placed ──────────────────────────────────────────────

describe("composition part placement", () => {
    it("every axis direction survives being stored as a code", () => {
        for (let code = 0; code < DIR_VEC_BY_CODE.length; ++code)
            expect(DirUtil.dirVecToCode(DIR_VEC_BY_CODE[code])).toBe(code);
    });

    it("a direction a little off an axis snaps to that axis rather than failing", () => {
        for (let code = 0; code < DIR_VEC_BY_CODE.length; ++code)
        {
            const dirVec = DIR_VEC_BY_CODE[code];
            const nudged = {x: dirVec.x + 0.01, y: dirVec.y - 0.02, z: dirVec.z + 0.015};
            expect(DirUtil.dirVecToCode(nudged)).toBe(code);
        }
    });

    // The overlap test that gives stacked squares their relief has to agree with the basis three.js
    // turns a part to, or it would compare footprints the renderer never draws (see InstancedPartUtil).
    it("the facing basis matches the one three.js orients a part with", () => {
        for (const dir of DIR_VEC_BY_CODE)
        {
            const basis = Geometry3DUtil.getFacingBasis(dir);

            const obj = new THREE.Object3D();
            obj.lookAt(new THREE.Vector3(dir.x, dir.y, dir.z));
            obj.updateMatrixWorld();
            const right = new THREE.Vector3().setFromMatrixColumn(obj.matrixWorld, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(obj.matrixWorld, 1);

            for (const [ours, theirs] of [[basis.right, right], [basis.up, up]] as const)
            {
                expect(ours.x).toBeCloseTo(theirs.x, 3);
                expect(ours.y).toBeCloseTo(theirs.y, 3);
                expect(ours.z).toBeCloseTo(theirs.z, 3);
            }
        }
    });
});
