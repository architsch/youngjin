/**
 * Integration tests: the cheat code that gives dollars (see DebugCommandUtil, UserCommandUtil), from what is typed to the
 * server adding them to what the user holds, which a dev server alone does, for whoever asks there, whatever a browser
 * sends. Anywhere else it is no command at all. What it writes is the DB suite's.
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
import { notificationMessageObservable } from "../../../src/client/system/clientObservables";
import DebugCommandUtil from "../../../src/client/system/util/debugCommandUtil";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import UserContext from "../../../src/server/sockets/types/userContext";
import UserCommandUtil from "../../../src/server/user/util/userCommandUtil";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import { CHEAT_DOLLARS } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import UserCommandSignal from "../../../src/shared/user/types/userCommandSignal";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const COMMAND = "rosebud";
const SIGNAL = "grantCheatDollars";
const DOLLAR = InventoryItemTypeEnumMap.Dollar;

// A connection holding a few dollars already, which hears what the server tells it.
function contextOf(userType: number): UserContext & {told: string[]}
{
    const told: string[] = [];
    return {user: new User("someone", "someone", userType, ""), inventory: {[DOLLAR]: 3}, told,
        addPendingSignalToUser: (signalType: string) => { told.push(signalType); }} as unknown as UserContext & {told: string[]};
}

describe("the cheat code that gives dollars", () => {
    const emit = () => SocketsClient.emitUserCommandSignal as Mock;
    const addItem = () => DBInventoryUtil.addItem as Mock;

    beforeEach(() => {
        emit().mockClear();
        addItem().mockClear();
        notificationMessageObservable.set("");
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
        expect(signal.message).toBe(SIGNAL);
        expect(notificationMessageObservable.peek()).toContain(`$${CHEAT_DOLLARS}`);

        vi.stubEnv("MODE", "dev");
        for (const userType of [UserTypeEnumMap.Guest, UserTypeEnumMap.Member, UserTypeEnumMap.Admin])
        {
            addItem().mockClear();
            const ctx = contextOf(userType);
            await UserCommandUtil.onUserCommandSignalReceived(ctx, signal);
            expect(ctx.inventory[DOLLAR]).toBe(3 + CHEAT_DOLLARS);
            expect(ctx.told).toEqual(["inventorySignal"]);
            expect(addItem()).toHaveBeenCalledExactlyOnceWith("someone", DOLLAR, CHEAT_DOLLARS);
        }
    });

    it("is no command anywhere but a dev server, and sends nothing", () => {
        for (const mode of ["prod", ""])
        {
            (App.getEnv as Mock).mockReturnValue({mode});
            notificationMessageObservable.set("");
            DebugCommandUtil.run(COMMAND);
            expect(notificationMessageObservable.peek()).toBe("Unknown debug command.");
        }
        expect(emit()).not.toHaveBeenCalled();
    });

    it("is refused by any other server, whatever a browser sends", async () => {
        for (const mode of ["prod", "ssg", ""])
        {
            vi.stubEnv("MODE", mode);
            const ctx = contextOf(UserTypeEnumMap.Admin);
            await UserCommandUtil.onUserCommandSignalReceived(ctx, new UserCommandSignal(SIGNAL));
            expect(ctx.inventory[DOLLAR]).toBe(3);
            expect(ctx.told).toEqual([]);
        }
        expect(addItem()).not.toHaveBeenCalled();
    });
});
