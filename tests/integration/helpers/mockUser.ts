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
    playerMetadata?: {[key: string]: string};
}

export interface MockUserResult {
    user: User;
    playerMetadata: {[key: string]: string};
}

/**
 * Creates a unique mock User for testing. Each call returns a user with a
 * unique ID so that multiple concurrent users never collide.
 * Player metadata is per-user (stored on DBUser) and is returned alongside the user.
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
    return { user, playerMetadata: overrides.playerMetadata ?? {} };
}

/** Resets the internal counter (call in beforeEach/afterEach). */
export function resetUserCounter(): void
{
    userCounter = 0;
}
