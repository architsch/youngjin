/**
 * Integration tests: asking a guest to sign in as a page's first dollar reaches them (see SignInPromptUtil): by a bill or a
 * login's reward, whose mark goes first; once in a page's life; beneath the count, with a button to sign in and an x; never
 * asked of anyone signed in. Each test is a page of its own, the util keeping what it has done for as long as the page
 * lasts.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/app", () => ({ default: { getUser: vi.fn() } }));

import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const SHOW_DELAY_MS = 1400;

describe("asking a guest to sign in", () => {
    let observables: typeof import("../../../src/client/system/clientObservables");
    let popups: string[];

    const marks = () => observables.screenCoachMarksObservable.peek();
    const gainDollar = () => observables.inventoryGainObservable.set(InventoryItemTypeEnumMap.Dollar);

    async function openPage(userType: number): Promise<void>
    {
        vi.resetModules();
        const {default: App} = await import("../../../src/client/app");
        (App.getUser as Mock).mockReturnValue({userType});
        observables = await import("../../../src/client/system/clientObservables");
        await import("../../../src/client/ui/util/signInPromptUtil");
        popups = [];
        observables.popupStateObservable.addListener("test", state => { popups.push(state.popupType); });
    }

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("comes under the count once the bounce of a bill's arrival has ended, as a regular mark with a button and an x", async () => {
        await openPage(UserTypeEnumMap.Guest);
        expect(marks()).toEqual([]);

        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS - 1);
        expect(marks()).toEqual([]);

        vi.advanceTimersByTime(1);
        expect(marks()).toEqual([expect.objectContaining({targetElementId: "dollarCounter", text: "to save your progress",
            button: expect.objectContaining({label: "Sign In"}), onDismiss: expect.any(Function)})]);
        expect(marks()[0].reward).toBeUndefined();
    });

    it("waits for a login's reward to be gone, however soon a bill follows it, and shows no sooner for the bill", async () => {
        await openPage(UserTypeEnumMap.Guest);
        const stage = observables.loginRewardStageObservable;

        stage.set("waiting");
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);

        stage.set("shown");
        gainDollar();
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);

        stage.set("none");
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        expect(marks().map(mark => mark.text)).toEqual(["to save your progress"]);
    });

    it("counts a login's reward as a first dollar", async () => {
        await openPage(UserTypeEnumMap.Guest);
        const stage = observables.loginRewardStageObservable;
        stage.set("waiting");
        stage.set("shown");
        stage.set("none");
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        expect(marks()).toHaveLength(1);
    });

    it("isn't asked of a reward not yet shown, nor of anything that isn't a dollar", async () => {
        await openPage(UserTypeEnumMap.Guest);
        observables.loginRewardStageObservable.set("none");
        observables.inventoryGainObservable.set("somethingElse");
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);
    });

    it("comes once in a page's life, whatever is gained after, shown or closed", async () => {
        await openPage(UserTypeEnumMap.Guest);
        gainDollar();
        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        gainDollar();
        vi.advanceTimersByTime(60_000);
        expect(marks()).toHaveLength(1);

        marks()[0].onDismiss!();
        expect(marks()).toEqual([]);

        gainDollar();
        observables.loginRewardStageObservable.set("shown");
        observables.loginRewardStageObservable.set("none");
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);
    });

    it("comes again in the next page's life", async () => {
        await openPage(UserTypeEnumMap.Guest);
        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        marks()[0].onDismiss!();

        await openPage(UserTypeEnumMap.Guest);
        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        expect(marks()).toHaveLength(1);
    });

    it("stays until closed, however long, and however many times they look at signing in", async () => {
        await openPage(UserTypeEnumMap.Guest);
        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS + 24 * 60 * 60 * 1000);
        expect(marks()).toHaveLength(1);

        marks()[0].button!.onClick();
        marks()[0].button!.onClick();
        expect(popups).toEqual(["authPrompt", "authPrompt"]);
        expect(marks()).toHaveLength(1);
    });

    it("closes only itself", async () => {
        await openPage(UserTypeEnumMap.Guest);
        const other = {targetElementId: "gameModeToggleSwitch", text: "Try Editing"};
        observables.screenCoachMarksObservable.set([other]);
        gainDollar();
        vi.advanceTimersByTime(SHOW_DELAY_MS);
        expect(marks()).toHaveLength(2);

        marks()[1].onDismiss!();
        expect(marks()).toEqual([other]);
    });

    it("is never asked of anyone signed in", async () => {
        for (const userType of [UserTypeEnumMap.Member, UserTypeEnumMap.Admin])
        {
            await openPage(userType);
            gainDollar();
            observables.loginRewardStageObservable.set("shown");
            observables.loginRewardStageObservable.set("none");
            vi.advanceTimersByTime(60_000);
            expect(marks()).toEqual([]);
        }
    });
});
