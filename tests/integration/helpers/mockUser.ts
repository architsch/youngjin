import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

let userCounter = 0;

export interface MockUserOverrides {
    id?: string;
    userName?: string;
    userType?: number;
    email?: string;
    singlePlayerMode?: string;
    lastRoomID?: string;
    ownedRoomID?: string;
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
        overrides.singlePlayerMode ?? "",
        overrides.lastRoomID ?? "",
        overrides.ownedRoomID ?? "",
    );
    return { user, playerMetadata: overrides.playerMetadata ?? {} };
}

/**
 * A stand-in for whoever is doing the editing, for helpers and assertions that are not about who is
 * asking. Every room-editing utility is told who is asking (see RoomValidationUtil), so a test
 * exercising something else still has to name somebody.
 */
export function createEditingUser(userType: number = UserTypeEnumMap.Admin): User
{
    return createMockUser({userType}).user;
}

/** Resets the internal counter (call in beforeEach/afterEach). */
export function resetUserCounter(): void
{
    userCounter = 0;
}
