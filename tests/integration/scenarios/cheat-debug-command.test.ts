/**
 * Integration tests: the cheat code that gives dollars (see DebugCommandUtil, UserCommandUtil), "rosebud" or "rosebud N"
 * for N times as many, from what is typed to the server adding them to what the user holds, which a dev server alone
 * does, for whoever asks there, whatever a browser sends, never past what the count can be sent with. Anywhere else it
 * is no command at all. What it writes is the DB suite's.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    return { default: { getScene: () => scene } };
});

vi.mock("../../../src/client/app", () => ({ default: { getUser: vi.fn(), getCurrentRoom: vi.fn(), getEnv: vi.fn() } }));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: { emitUserCommandSignal: vi.fn() } }));

vi.mock("../../../src/server/db/util/dbInventoryUtil", () => ({ default: { addItem: vi.fn(async () => {}) } }));

import App from "../../../src/client/app";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { inventoryObservable, notificationMessageObservable } from "../../../src/client/system/clientObservables";
import DebugCommandUtil from "../../../src/client/system/util/debugCommandUtil";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import UserContext from "../../../src/server/sockets/types/userContext";
import UserCommandUtil from "../../../src/server/user/util/userCommandUtil";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import EncodableRaw4ByteNumber from "../../../src/shared/networking/types/encodableRaw4ByteNumber";
import { CHEAT_DOLLARS } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import UserCommandSignal from "../../../src/shared/user/types/userCommandSignal";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const COMMAND = "rosebud";
const SIGNAL = "grantCheatDollars";
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
const HELD = 3;
// The most times over that one holding HELD dollars may ask for, past which the count could not be sent.
const MOST_TIMES = Math.floor((EncodableRaw4ByteNumber.MAX_VALUE - HELD) / CHEAT_DOLLARS);

// A connection holding a few dollars already, which hears what the server tells it.
function contextOf(userType: number): UserContext & {told: string[]}
{
    const told: string[] = [];
    return {user: new User("someone", "someone", userType, ""), inventory: {[DOLLAR]: HELD}, told,
        addPendingSignalToUser: (signalType: string) => { told.push(signalType); }} as unknown as UserContext & {told: string[]};
}

describe("the cheat code that gives dollars", () => {
    const emit = () => SocketsClient.emitUserCommandSignal as Mock;
    const addItem = () => DBInventoryUtil.addItem as Mock;

    beforeEach(() => {
        emit().mockClear();
        addItem().mockClear();
        notificationMessageObservable.set("");
        inventoryObservable.set({});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it(`gives whoever types it on a dev server, in any case, ${CHEAT_DOLLARS} dollars more, and tells them`, async () => {
        (App.getEnv as Mock).mockReturnValue({mode: "dev"});
        DebugCommandUtil.run(`  ${COMMAND.toUpperCase()} `);
        expect(emit()).toHaveBeenCalledTimes(1);
        const signal = emit().mock.lastCall![0] as UserCommandSignal;
        expect(signal.message).toBe(`${SIGNAL} 1`);
        expect(notificationMessageObservable.peek()).toContain(`+$${CHEAT_DOLLARS}.`);

        vi.stubEnv("MODE", "dev");
        for (const userType of [UserTypeEnumMap.Guest, UserTypeEnumMap.Member, UserTypeEnumMap.Admin])
        {
            addItem().mockClear();
            const ctx = contextOf(userType);
            await UserCommandUtil.onUserCommandSignalReceived(ctx, signal);
            expect(ctx.inventory[DOLLAR]).toBe(HELD + CHEAT_DOLLARS);
            expect(ctx.told).toEqual(["inventorySignal"]);
            expect(addItem()).toHaveBeenCalledExactlyOnceWith("someone", DOLLAR, CHEAT_DOLLARS);
        }

        // As a browser from before the multiplier sends it.
        const ctx = contextOf(UserTypeEnumMap.Guest);
        await UserCommandUtil.onUserCommandSignalReceived(ctx, new UserCommandSignal(SIGNAL));
        expect(ctx.inventory[DOLLAR]).toBe(HELD + CHEAT_DOLLARS);
    });

    it("gives N times as many for a whole number N from 1 up typed after it, and tells them", async () => {
        (App.getEnv as Mock).mockReturnValue({mode: "dev"});
        vi.stubEnv("MODE", "dev");
        for (const times of [1, 2, 3, 120])
        {
            emit().mockClear();
            addItem().mockClear();
            DebugCommandUtil.run(`${COMMAND}  ${times}`);
            expect(emit()).toHaveBeenCalledTimes(1);
            expect(notificationMessageObservable.peek()).toContain(`+$${times * CHEAT_DOLLARS}.`);

            const ctx = contextOf(UserTypeEnumMap.Guest);
            await UserCommandUtil.onUserCommandSignalReceived(ctx, emit().mock.lastCall![0] as UserCommandSignal);
            expect(ctx.inventory[DOLLAR]).toBe(HELD + times * CHEAT_DOLLARS);
            expect(addItem()).toHaveBeenCalledExactlyOnceWith("someone", DOLLAR, times * CHEAT_DOLLARS);
        }
    });

    it("is no command with anything but a whole number from 1 up after it, and sends nothing", () => {
        (App.getEnv as Mock).mockReturnValue({mode: "dev"});
        for (const typed of [`${COMMAND} 0`, `${COMMAND} 00`, `${COMMAND} -2`, `${COMMAND} 1.5`, `${COMMAND} 1e3`,
            `${COMMAND} x`, `${COMMAND} 2 3`, `${COMMAND}2`, `${COMMAND}s`])
        {
            notificationMessageObservable.set("");
            DebugCommandUtil.run(typed);
            expect(notificationMessageObservable.peek(), typed).toBe("Unknown debug command.");
        }
        expect(emit()).not.toHaveBeenCalled();
    });

    it("never takes what someone holds past what the count can be sent with", async () => {
        (App.getEnv as Mock).mockReturnValue({mode: "dev"});
        vi.stubEnv("MODE", "dev");
        inventoryObservable.set({[DOLLAR]: HELD});
        DebugCommandUtil.run(`${COMMAND} ${MOST_TIMES + 1}`);
        expect(emit()).not.toHaveBeenCalled();
        expect(notificationMessageObservable.peek()).toBe("Rosebud: more dollars than the count can hold.");
        DebugCommandUtil.run(`${COMMAND} ${MOST_TIMES}`);
        expect(emit()).toHaveBeenCalledTimes(1);

        const ctx = contextOf(UserTypeEnumMap.Guest);
        await UserCommandUtil.onUserCommandSignalReceived(ctx, new UserCommandSignal(`${SIGNAL} ${MOST_TIMES + 1}`));
        expect(ctx.inventory[DOLLAR]).toBe(HELD);
        await UserCommandUtil.onUserCommandSignalReceived(ctx, emit().mock.lastCall![0] as UserCommandSignal);
        expect(ctx.inventory[DOLLAR]).toBe(HELD + MOST_TIMES * CHEAT_DOLLARS);
        expect(ctx.inventory[DOLLAR]).toBeLessThanOrEqual(EncodableRaw4ByteNumber.MAX_VALUE);
    });

    it("is no command anywhere but a dev server, and sends nothing", () => {
        for (const mode of ["prod", ""])
        {
            (App.getEnv as Mock).mockReturnValue({mode});
            for (const typed of [COMMAND, `${COMMAND} 3`])
            {
                notificationMessageObservable.set("");
                DebugCommandUtil.run(typed);
                expect(notificationMessageObservable.peek()).toBe("Unknown debug command.");
            }
        }
        expect(emit()).not.toHaveBeenCalled();
    });

    it("is refused by any other server, whatever a browser sends", async () => {
        for (const mode of ["prod", "ssg", ""])
        {
            vi.stubEnv("MODE", mode);
            for (const message of [SIGNAL, `${SIGNAL} 3`])
            {
                const ctx = contextOf(UserTypeEnumMap.Admin);
                await UserCommandUtil.onUserCommandSignalReceived(ctx, new UserCommandSignal(message));
                expect(ctx.inventory[DOLLAR]).toBe(HELD);
                expect(ctx.told).toEqual([]);
            }
        }
        expect(addItem()).not.toHaveBeenCalled();
    });

    it("is refused by a dev server for any word but a whole number from 1 up", async () => {
        vi.stubEnv("MODE", "dev");
        for (const word of ["0", "-1", "1.5", "1e3", "x", ""])
        {
            const ctx = contextOf(UserTypeEnumMap.Admin);
            await UserCommandUtil.onUserCommandSignalReceived(ctx, new UserCommandSignal(`${SIGNAL} ${word}`));
            expect(ctx.inventory[DOLLAR], word).toBe(HELD);
            expect(ctx.told).toEqual([]);
        }
        expect(addItem()).not.toHaveBeenCalled();
    });
});
