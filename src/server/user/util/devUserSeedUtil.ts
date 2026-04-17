import DBUserUtil from "../../db/util/dbUserUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import LogUtil from "../../../shared/system/util/logUtil";

interface DevUserDef
{
    userName: string;
    email: string;
}

const DEV_USERS: DevUserDef[] = [
    { userName: "DevMember1", email: "devmember1@test.com" },
    { userName: "DevMember2", email: "devmember2@test.com" },
    { userName: "DevMember3", email: "devmember3@test.com" },
];

// Maps dev user index (1-based) to Firestore document ID after seeding
const devUserIds: Map<number, string> = new Map();

const DevUserSeedUtil =
{
    seed: async (): Promise<void> =>
    {
        for (let i = 0; i < DEV_USERS.length; i++)
        {
            const def = DEV_USERS[i];
            const existing = await DBSearchUtil.users.withEmail(def.email);
            if (existing.success && existing.data.length > 0)
            {
                devUserIds.set(i + 1, existing.data[0].id!);
                LogUtil.logRaw(`[DevSeed] Dev user "${def.userName}" already exists (id=${existing.data[0].id})`, "low", "info");
                continue;
            }
            const result = await DBUserUtil.createUser(def.userName, UserTypeEnumMap.Member, def.email);
            if (result.success && result.data.length > 0)
            {
                devUserIds.set(i + 1, result.data[0].id);
                LogUtil.logRaw(`[DevSeed] Created dev user "${def.userName}" (id=${result.data[0].id})`, "low", "info");
            }
            else
            {
                LogUtil.logRaw(`[DevSeed] Failed to create dev user "${def.userName}"`, "high", "error");
            }
        }
        console.log("---------------------------------------------");
        console.log("Dev users seeded. Access them via ?devuser=N:");
        devUserIds.forEach((id, index) =>
        {
            const def = DEV_USERS[index - 1];
            console.log(`  ?devuser=${index}  ->  ${def.userName} (${def.email}) [id=${id}]`);
        });
    },
    getUserIdByIndex: (index: number): string | undefined =>
    {
        return devUserIds.get(index);
    },
}

export default DevUserSeedUtil;
