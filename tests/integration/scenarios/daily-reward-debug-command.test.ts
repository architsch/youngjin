/**
 * Integration tests: the debug command that fast-forwards the daily reward's clock (see DebugCommandUtil, UserCommandUtil),
 * from what is typed to the server moving the clock, which an admin alone may have it do, whatever a browser sends. What
 * it writes is the DB suite's.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    return { default: { getScene: () => scene } };
});

vi.mock("../../../src/client/app", () => ({ default: { getUser: vi.fn(), getCurrentRoom: vi.fn() } }));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: { emitUserCommandSignal: vi.fn() } }));

vi.mock("../../../src/server/db/util/dbInventoryUtil", () => ({ default: { fastForwardLoginRewardClock: vi.fn(async () => {}) } }));

import App from "../../../src/client/app";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { notificationMessageObservable } from "../../../src/client/system/clientObservables";
import DebugCommandUtil from "../../../src/client/system/util/debugCommandUtil";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import UserCommandUtil from "../../../src/server/user/util/userCommandUtil";
import UserContext from "../../../src/server/sockets/types/userContext";
import User from "../../../src/shared/user/types/user";
import UserCommandSignal from "../../../src/shared/user/types/userCommandSignal";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const COMMAND = "fast_forward_daily_reward_clock";
const SIGNAL = "fastForwardDailyRewardClock";

const userOfType = (userType: number) => new User("someone", "someone", userType, "");
// The connection a command comes in on, as far as this one reads it.
const contextOf = (user: User) => ({user}) as unknown as UserContext;

describe("the debug command that fast-forwards the daily reward's clock", () => {
    const emit = () => SocketsClient.emitUserCommandSignal as Mock;
    const fastForward = () => DBInventoryUtil.fastForwardLoginRewardClock as Mock;

    beforeEach(() => {
        emit().mockClear();
        fastForward().mockClear();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("moves an admin's clock from what they type, in any case, and tells them to reload", async () => {
        const admin = userOfType(UserTypeEnumMap.Admin);
        (App.getUser as Mock).mockReturnValue(admin);

        DebugCommandUtil.run(`  ${COMMAND.toUpperCase()} `);

        expect(emit()).toHaveBeenCalledTimes(1);
        const signal = emit().mock.lastCall![0] as UserCommandSignal;
        expect(signal.message).toBe(SIGNAL);
        expect(notificationMessageObservable.peek()).toMatch(/reload/i);

        await UserCommandUtil.onUserCommandSignalReceived(contextOf(admin), signal);
        expect(fastForward()).toHaveBeenCalledExactlyOnceWith("someone");
    });

    it("sends nothing from anyone else's browser, and says why", () => {
        for (const userType of [UserTypeEnumMap.Guest, UserTypeEnumMap.Member])
        {
            (App.getUser as Mock).mockReturnValue(userOfType(userType));
            DebugCommandUtil.run(COMMAND);
            expect(notificationMessageObservable.peek()).toMatch(/only an admin/i);
        }
        expect(emit()).not.toHaveBeenCalled();
    });

    it("is refused by the server from anyone else, whatever their browser sends", async () => {
        for (const userType of [UserTypeEnumMap.Guest, UserTypeEnumMap.Member, UserTypeEnumMap.Agent])
            await UserCommandUtil.onUserCommandSignalReceived(contextOf(userOfType(userType)), new UserCommandSignal(SIGNAL));
        expect(fastForward()).not.toHaveBeenCalled();
    });
});
