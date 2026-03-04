import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

let userCounter = 0;

export interface MockUserOverrides {
    id?: string;
    userName?: string;
    userType?: number;
    email?: string;
    tutorialStep?: number;
    lastRoomID?: string;
    lastX?: number;
    lastY?: number;
    lastZ?: number;
    lastDirX?: number;
    lastDirY?: number;
    lastDirZ?: number;
    playerMetadata?: {[key: string]: string};
}

export interface MockUserResult {
    user: User;
    initialPosition: {
        lastX: number;
        lastY: number;
        lastZ: number;
        lastDirX: number;
        lastDirY: number;
        lastDirZ: number;
        playerMetadata: {[key: string]: string};
    };
}

/**
 * Creates a unique mock User for testing. Each call returns a user with a
 * unique ID so that multiple concurrent users never collide.
 * Also returns the initial position data separately since it's no longer on User.
 */
export function createMockUser(overrides: MockUserOverrides = {}): MockUserResult
{
    const i = ++userCounter;
    const user = new User(
        overrides.id ?? `test-user-${i}`,
        overrides.userName ?? `TestUser${i}`,
        overrides.userType ?? UserTypeEnumMap.Guest,
        overrides.email ?? `test${i}@test.com`,
        overrides.tutorialStep ?? 0,
        overrides.lastRoomID ?? "",
    );
    const initialPosition = {
        lastX: overrides.lastX ?? 16,
        lastY: overrides.lastY ?? 0,
        lastZ: overrides.lastZ ?? 16,
        lastDirX: overrides.lastDirX ?? 0,
        lastDirY: overrides.lastDirY ?? 0,
        lastDirZ: overrides.lastDirZ ?? 1,
        playerMetadata: overrides.playerMetadata ?? {},
    };
    return { user, initialPosition };
}

/** Resets the internal counter (call in beforeEach/afterEach). */
export function resetUserCounter(): void
{
    userCounter = 0;
}
