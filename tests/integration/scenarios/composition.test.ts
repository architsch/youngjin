/**
 * Scenario tests: Player mesh composition (InstancedMeshComposition)
 *
 * A player's appearance is an encoded string carried in the player object's metadata. The owner
 * writes it, the server relays it to everyone else in the room, and every receiving client decodes
 * it to build that player's body — so the string is untrusted input on the read side.
 *
 * Covers:
 * - Codec round-trip, determinism, and canonical (re-encodable) decoded params
 * - Codec robustness: a malformed or hostile string must never throw, and must still yield a body
 * - Permissions: only the owner may set his/her own composition, and only on allowed metadata keys
 * - Preprocessing: an oversized composition is truncated by the server
 * - Relay: a composition change reaches the other participants
 * - Persistence: a composition survives reconnection and room switches
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
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
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/util/doorObjectUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { InstancedMeshCompositionBuilderMap } from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";

const COMPOSITION_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;

// Asserts that a decoded composition is something the renderer can actually draw. The part count is
// deliberately not checked: it varies with the chosen body-part variants, so pinning it would only
// assert which variants a given string happens to select.
function expectRenderableBody(
    params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]): void
{
    expect(parts.length).toBeGreaterThan(0);

    // Every part must be drawn with one of the instanced meshes the composition itself declares —
    // anything else would have no mesh to rent an instance from.
    const declaredMeshIds = Object.values(params.ids as {[id: string]: string});
    for (const part of parts)
    {
        expect(declaredMeshIds).toContain(part.instancedMeshId);
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
                // A decoded part type must always name a body-part variant that exists, otherwise
                // the body cannot be built from it.
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
 * A door's appearance is carried the same way a player's is — an encoded string in the object's
 * InstancedMeshComposition metadata — but is decided for the door rather than chosen by anyone, and
 * has to come out the same for every player standing in the room and the same again next session.
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

    it("every authored color scheme survives the palette the codec quantizes to", () => {
        // A scheme is written as hex and encoded as a palette position, so a color that does not
        // land on a palette entry would come back as a different one and the finish would not be
        // what was authored. Asserted here rather than trusted, since the palette may change.
        for (const scheme of DoorCompositionConstants.colorSchemes)
        {
            for (const color of Object.values(scheme))
            {
                expect(ColorUtil.paletteIndexToRGB("Timber",
                    ColorUtil.rgbToPaletteIndex("Timber", color))).toEqual(color);
            }
        }
    });

    it("every palette round-trips its own colors, and none outgrows what can name it", () => {
        // A palette's positions are what every stored appearance means, and a position is one
        // visible-ASCII character. Both halves of that are checked here rather than assumed: a
        // palette that outgrew the encoding would hold colors nothing could write down, and a color
        // that did not come back as itself would repaint whatever was saved as it.
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
        // A client-spawned object carries the viewing user's id, so anything derived from the user
        // would give each player in a room a different door. Two rooms should differ; the same room
        // must not.
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

    it("a door's default appearance is one of the authored schemes", () => {
        for (let i = 0; i < 40; ++i)
        {
            const {params} = generateDefaultDoorComposition(`room-${i}`, ENTRANCE_DOOR_OBJECT_ID);
            expect(DoorCompositionConstants.colorSchemes).toContainEqual(params.colors);
        }
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("a door is finished by an admin in a hub, and by nobody else anywhere", () => {
        // What a door looks like is part of what an admin builds a world out of — one hub's doors
        // told apart from another's at a glance. It is not a room's users' to change, and not even
        // an admin's in a Regular room, whose one door is that room's own.
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

    it("every part of a door is drawn by a mesh the composition itself declares", () => {
        const {params, parts} = DoorCompositionCodec.getRandomComposition(1);
        // A door is laid down back to front, each region in front of what it is let into, so that
        // quads sharing a plane never z-fight (see DoorCompositionConstants).
        expectRenderableBody(params, parts);
        expectMouldedParts(parts);
        const reliefs = parts.map((part) => Math.abs(part.offset.z));
        expect(Math.min(...reliefs)).toBeGreaterThan(0);
        expect(new Set(reliefs).size).toBeGreaterThan(1);
    });
});

// Asserts that every part carries the per-instance moulding inputs the wood material reads. A part
// missing them would be drawn with a zero-width band and no trim color at all.
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
