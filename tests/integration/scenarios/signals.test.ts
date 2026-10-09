/**
 * Scenario tests: signal emission — multicast excludes the sender, unicast rollbacks reach only the
 * sender, desyncs reach everyone, nothing leaks across rooms, a batch keeps the order its signals were
 * queued in across their types, and batching/pending queues.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import zlib from "zlib";
import { inflateSync } from "fflate";
import { runScenario } from "../helpers/scenarioRunner";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals, checkMulticastSignalReach } from "../helpers/invariants";
import {
    EMPTY_REGULAR, EMPTY_HUB, hubRoom, regularRoom,
    usersInRoom, userAt, userAtCenter,
} from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableArray from "../../../src/shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../src/shared/networking/types/encodableRawByteNumber";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import RoomChangedSignal from "../../../src/shared/room/types/roomChangedSignal";
import { SIGNAL_BATCH_DEFLATE_MIN_BYTES } from "../../../src/server/system/serverConstants";

describe("signal emission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("object transform multicast reaches all except sender", async () => {
        await runScenario({
            name: "transform multicast",
            rooms: [EMPTY_REGULAR],
            users: usersInRoom(3, "regular"),
            actions: [
                { type: "moveObject", userIndex: 0, x: 17, y: 0, z: 17 },
            ],
            assertions: ({ users }) => {
                // Users 1 and 2 should have received the transform signal
                const u1Signals = getPendingSignals(users[1], "setObjectTransformSignal");
                const u2Signals = getPendingSignals(users[2], "setObjectTransformSignal");
                // At least one pending signal for observers (the spawn may add more).
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("voxel add multicast reaches all except sender", async () => {
        await runScenario({
            name: "voxel add multicast",
            rooms: [hubRoom("sig-hub")],
            users: usersInRoom(3, "sig-hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                const u1Signals = getPendingSignals(users[1], "addVoxelBlockSignal");
                const u2Signals = getPendingSignals(users[2], "addVoxelBlockSignal");
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
                // Sender should NOT have received the multicast
                const u0Signals = getPendingSignals(users[0], "addVoxelBlockSignal");
                expect(u0Signals.length).toBe(0);
            },
        });
    });

    it("a refused voxel operation is answered to its sender alone, with what the cell really holds", async () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, 0);
        await runScenario({
            name: "voxel refusal unicast",
            rooms: [hubRoom("rollback-hub")],
            users: usersInRoom(2, "rollback-hub"),
            actions: [
                // A block goes up, then the same user tries to put another in its place (refused).
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0, textures: [1, 2, 3, 4, 5, 6] },
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // The sender is told of the block the server holds there, which their own copy is replaced
                // by: an accepted edit is never echoed, so this is the answer to the refused one.
                const answers = getPendingSignals(users[0], "addVoxelBlockSignal");
                expect(answers.length).toBe(1);
                expect(answers[0]).toMatchObject({quadIndex, quadTextureIndicesWithinLayer: [1, 2, 3, 4, 5, 6]});
                expect(getPendingSignals(users[0], "removeVoxelBlockSignal").length).toBe(0);

                // The other user heard of the block once, and nothing of the refusal.
                expect(getPendingSignals(users[1], "addVoxelBlockSignal").length).toBe(1);
                expect(getPendingSignals(users[1], "removeVoxelBlockSignal").length).toBe(0);
            },
        });
    });

    it("a refused voxel operation on an empty cell is answered with its removal", async () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, 0);
        const quadIndexBeside = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 11, 0);
        await runScenario({
            name: "voxel refusal on an empty cell",
            rooms: [hubRoom("rollback-hub")],
            users: usersInRoom(2, "rollback-hub"),
            actions: [
                // Nothing stands there to move or take away.
                { type: "moveVoxel", userIndex: 0, row: 10, col: 10, layer: 0, dRow: 0, dCol: 1, dLayer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // A refused move is answered for the cell it took from and the one it went to.
                const answers = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(answers.map(answer => answer.quadIndex)).toEqual([quadIndex, quadIndexBeside, quadIndex]);
                expect(getPendingSignals(users[0], "addVoxelBlockSignal").length).toBe(0);
                for (const signalType of ["removeVoxelBlockSignal", "addVoxelBlockSignal", "moveVoxelBlockSignal"])
                    expect(getPendingSignals(users[1], signalType).length, signalType).toBe(0);
            },
        });
    });

    it("relays the edits of one batch in the order they were made, whatever their kinds", async () => {
        await runScenario({
            name: "batch order across signal types",
            rooms: [hubRoom("order-hub")],
            users: usersInRoom(2, "order-hub"),
            actions: [
                // A block put up, taken down and put up again, as an edit undone and redone sends it: told the
                // other way round, the last two would leave the others without the block.
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                { type: "setVoxelTexture", userIndex: 0, row: 10, col: 10, layer: 0, quadOffset: 1, textureIndex: 5 },
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // The other user's next batch, read as their client reads it.
                users[1].socket.clearEmitted();
                users[1].socketUserContext.processAllPendingSignalsToUser();
                const batches = users[1].socket.getEmittedSignalBatches();
                expect(batches).toHaveLength(1);

                const voxelEdits: string[] = [];
                const bufferState = new BufferState(batches[0]);
                while (bufferState.byteIndex < bufferState.view.byteLength)
                {
                    const config = SignalTypeConfigMap.getConfigByIndex(
                        (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n);
                    const signals = (EncodableArray.decodeWithParams(bufferState, config.decode, 65535) as EncodableArray).arr;
                    for (const _signal of signals)
                    {
                        if (config.signalType.includes("Voxel"))
                            voxelEdits.push(config.signalType);
                    }
                }
                expect(voxelEdits).toEqual(["addVoxelBlockSignal", "removeVoxelBlockSignal", "addVoxelBlockSignal",
                    "setVoxelQuadTextureSignal", "removeVoxelBlockSignal"]);

                // Sent, so nothing of it is left for the batch after.
                expect(getPendingSignals(users[1], "addVoxelBlockSignal")).toEqual([]);
            },
        });
    });

    describe("a long batch is sent deflated", () => {
        // The batch that carries so many transform signals and nothing else, as the server encodes it. The
        // last one's id can be padded, a byte a character, to bring the batch to an exact length.
        const transformSignals = (count: number, padding: number = 0): SetObjectTransformSignal[] =>
            Array.from({length: count}, (_, i) => new SetObjectTransformSignal("deflate-hub",
                `object-${i}` + ((i == count - 1) ? "x".repeat(padding) : ""),
                new ObjectTransform({x: 1 + i % 30, y: 0, z: 2}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}), false));
        const batchLength = (count: number, padding: number = 0): number => {
            const bufferState = EncodingUtil.startEncoding();
            new EncodableRawByteNumber(SignalTypeConfigMap.getIndexByType("setObjectTransformSignal")!).encode(bufferState);
            new EncodableArray(transformSignals(count, padding), 65535).encode(bufferState);
            return EncodingUtil.endEncoding(bufferState).byteLength;
        };
        // How the one batch a user is sent for these signals went out.
        const sendBatch = (user: ConnectedUser, count: number, padding: number = 0)
            : {event: string, sent: Uint8Array, read: Uint8Array} => {
            user.socketUserContext.clearAllPendingSignalsToUser();
            for (const signal of transformSignals(count, padding))
                user.socketUserContext.addPendingSignalToUser("setObjectTransformSignal", signal);
            user.socket.clearEmitted();
            user.socketUserContext.processAllPendingSignalsToUser();
            expect(user.socket.emitted).toHaveLength(1);
            return {event: user.socket.emitted[0].event, sent: new Uint8Array(user.socket.emitted[0].data),
                read: user.socket.getEmittedSignalBatches()[0]};
        };

        it("from the length that counts as long, and not below it", async () => {
            await runScenario({
                name: "deflated batch threshold",
                rooms: [hubRoom("deflate-hub")],
                users: usersInRoom(1, "deflate-hub"),
                actions: [],
                assertions: ({ users }) => {
                    // As many signals as stay short, then padded up to exactly the length that is long.
                    let count = 1;
                    while (batchLength(count + 1) < SIGNAL_BATCH_DEFLATE_MIN_BYTES)
                        ++count;
                    const padding = SIGNAL_BATCH_DEFLATE_MIN_BYTES - batchLength(count);
                    expect(padding).toBeGreaterThan(0);

                    const short = sendBatch(users[0], count, padding - 1);
                    expect(short.event).toBe("signalBatch");
                    expect(short.sent.length).toBe(SIGNAL_BATCH_DEFLATE_MIN_BYTES - 1);

                    const long = sendBatch(users[0], count, padding);
                    expect(long.event).toBe("deflatedSignalBatch");
                    expect(long.sent.length).toBeLessThan(SIGNAL_BATCH_DEFLATE_MIN_BYTES);
                    expect(long.read.length).toBe(SIGNAL_BATCH_DEFLATE_MIN_BYTES);
                },
            });
        });

        it("and a client reads the same signals out of it", async () => {
            await runScenario({
                name: "deflated batch contents",
                rooms: [hubRoom("deflate-hub")],
                users: usersInRoom(1, "deflate-hub"),
                actions: [],
                assertions: ({ users }) => {
                    const sent = transformSignals(60);
                    const {event, read} = sendBatch(users[0], sent.length);
                    expect(event).toBe("deflatedSignalBatch");

                    const bufferState = new BufferState(read);
                    expect((EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n)
                        .toBe(SignalTypeConfigMap.getIndexByType("setObjectTransformSignal"));
                    const received = (EncodableArray.decodeWithParams(bufferState, SetObjectTransformSignal.decode, 65535) as EncodableArray)
                        .arr as SetObjectTransformSignal[];
                    expect(bufferState.byteIndex).toBe(read.length);
                    expect(received.map(signal => signal.objectId)).toEqual(sent.map(signal => signal.objectId));
                    expect(received.map(signal => Math.round(signal.transform.pos.x)))
                        .toEqual(sent.map(signal => signal.transform.pos.x));
                },
            });
        });

        it("a whole room among them, many times shorter than it is", async () => {
            await runScenario({
                name: "deflated room",
                rooms: [hubRoom("deflate-hub")],
                users: usersInRoom(1, "deflate-hub"),
                actions: [],
                assertions: ({ users }) => {
                    const user = users[0];
                    const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories["deflate-hub"];
                    user.socketUserContext.clearAllPendingSignalsToUser();
                    user.socketUserContext.addPendingSignalToUser("roomChangedSignal", new RoomChangedSignal(roomRuntimeMemory));
                    user.socket.clearEmitted();
                    user.socketUserContext.processAllPendingSignalsToUser();

                    expect(user.socket.emitted.map(emission => emission.event)).toEqual(["deflatedSignalBatch"]);
                    const read = user.socket.getEmittedSignalBatches()[0];
                    expect(new Uint8Array(user.socket.emitted[0].data).length).toBeLessThan(read.length / 10);

                    const bufferState = new BufferState(read);
                    EncodableRawByteNumber.decode(bufferState);
                    const signals = (EncodableArray.decodeWithParams(bufferState, RoomChangedSignal.decode, 65535) as EncodableArray).arr;
                    expect(bufferState.byteIndex).toBe(read.length);
                    const received = (signals[0] as RoomChangedSignal).roomRuntimeMemory.room;
                    expect(received.id).toBe("deflate-hub");
                    expect(received.voxelQuads).toEqual(roomRuntimeMemory.room.voxelQuads);
                    expect(Object.keys(received.objectById).sort()).toEqual(Object.keys(roomRuntimeMemory.room.objectById).sort());
                },
            });
        });

        // The server deflates with zlib and the client inflates with a library of its own.
        it("with whatever bytes it holds coming back as they were", () => {
            fc.assert(fc.property(fc.uint8Array({maxLength: 5000}), (bytes) => {
                const deflated = zlib.deflateRawSync(bytes, {level: zlib.constants.Z_BEST_SPEED});
                expect(Array.from(inflateSync(new Uint8Array(deflated)))).toEqual(Array.from(bytes));
            }), {numRuns: 300});
        });
    });

    it("no signal leaks to users in other rooms", async () => {
        await runScenario({
            name: "no cross-room leaks",
            rooms: [hubRoom("room-A"), hubRoom("room-B")],
            users: [
                userAt(10, 10, "room-A"),
                userAt(20, 20, "room-B"),
            ],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // User in room-B should have no voxel signals
                const u1Signals = getPendingSignals(users[1], "addVoxelBlockSignal");
                expect(u1Signals.length).toBe(0);
            },
        });
    });

    it("chat message multicast reaches room participants", async () => {
        await runScenario({
            name: "chat message multicast",
            rooms: [EMPTY_REGULAR],
            users: usersInRoom(3, "regular"),
            actions: [
                { type: "sendMessage", userIndex: 0, message: "hello everyone" },
            ],
            assertions: ({ users }) => {
                const u1Signals = getPendingSignals(users[1], "setObjectMetadataSignal");
                const u2Signals = getPendingSignals(users[2], "setObjectMetadataSignal");
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("desync transform signal reaches ALL participants including sender", async () => {
        await runScenario({
            name: "desync broadcast to all",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(5, 5, "regular"),
                userAt(20, 20, "regular"),
            ],
            actions: [
                // Trigger a desync by moving an object the sender has no authority over
                { type: "moveObject", userIndex: 0, targetUserIndex: 1, x: 25, y: 0, z: 25 },
            ],
            assertions: ({ users }) => {
                // Desync broadcasts to everyone, sender included.
                const u0Signals = getPendingSignals(users[0], "setObjectTransformSignal");
                const u1Signals = getPendingSignals(users[1], "setObjectTransformSignal");
                expect(u0Signals.length, "sender should receive desync correction").toBeGreaterThanOrEqual(1);
                expect(u1Signals.length, "observer should receive desync correction").toBeGreaterThanOrEqual(1);
                // The correction is server-authoritative, so it overrides client physics instead of being re-simulated.
                const correction = u0Signals[u0Signals.length - 1];
                expect(correction.ignorePhysics, "correction must be authoritative").toBe(true);
            },
        });
    });
});
