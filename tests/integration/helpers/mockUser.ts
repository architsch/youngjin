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

/** A unique mock user, with its player metadata. */
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

/** A stand-in acting user, for tests not about who is asking (editing utilities require one). */
export function createEditingUser(userType: number = UserTypeEnumMap.Admin): User
{
    return createMockUser({userType}).user;
}

/** Resets the internal counter (call in beforeEach/afterEach). */
export function resetUserCounter(): void
{
    userCounter = 0;
}
