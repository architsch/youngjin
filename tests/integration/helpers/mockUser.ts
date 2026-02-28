import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

let userCounter = 0;

/**
 * Creates a unique mock User for testing. Each call returns a user with a
 * unique ID so that multiple concurrent users never collide.
 */
export function createMockUser(overrides: Partial<{
    id: string;
    userName: string;
    userType: number;
    email: string;
    tutorialStep: number;
    lastRoomID: string;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
}> = {}): User
{
    const i = ++userCounter;
    return new User(
        overrides.id ?? `test-user-${i}`,
        overrides.userName ?? `TestUser${i}`,
        overrides.userType ?? UserTypeEnumMap.Guest,
        overrides.email ?? `test${i}@test.com`,
        overrides.tutorialStep ?? 0,
        overrides.lastRoomID ?? "",
        overrides.lastX ?? 16,
        overrides.lastY ?? 0,
        overrides.lastZ ?? 16,
        overrides.lastDirX ?? 0,
        overrides.lastDirY ?? 0,
        overrides.lastDirZ ?? 1,
        overrides.playerMetadata ?? {},
    );
}

/** Resets the internal counter (call in beforeEach/afterEach). */
export function resetUserCounter(): void
{
    userCounter = 0;
}
