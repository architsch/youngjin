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
} from "../helpers/composition";
import { PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
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
