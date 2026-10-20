import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBUser from "../../db/types/row/dbUser";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import GuestCreationLimitUtil from "../../user/util/guestCreationLimitUtil";
import AcquisitionSourceUtil from "../../analytics/util/acquisitionSourceUtil";
import { AGENT_ACQUISITION_SOURCE_PREFIX, AGENT_NAME_MAX_LENGTH, AGENT_NAME_MIN_LENGTH,
    HELPER_AGENT_NAME } from "../../system/serverConstants";
import AgentRegistrationResult from "../types/agentRegistrationResult";
import AgentKeyUtil from "./agentKeyUtil";

// No spaces (User travels as a space-separated string), and nothing a zone could mistake for a rule, such as
// ZONE_USER_NAME_FOR_NOBODY.
const NAME_PATTERN = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_.-]{${AGENT_NAME_MIN_LENGTH - 1},${AGENT_NAME_MAX_LENGTH - 1}}$`);
// Guests are named so, unchecked for clashes (see UserIdentificationUtil).
const GUEST_NAME_PREFIX = "guest-";

const AgentAccountUtil =
{
    // An agent names itself. Names are unique, since restricted zones are kept for a user by name.
    register: async (requestedName: string, ref: string | undefined, ip: string,
        userAgent: string): Promise<AgentRegistrationResult> =>
    {
        const userName = requestedName.trim();
        if (!NAME_PATTERN.test(userName) || userName.toLowerCase().startsWith(GUEST_NAME_PREFIX))
        {
            return {error: `A name has ${AGENT_NAME_MIN_LENGTH} to ${AGENT_NAME_MAX_LENGTH} letters, digits, `
                + `'-', '_' or '.', starts with a letter or a digit, and doesn't start with "Guest-".`};
        }

        // What helpers are called, in any case, so that no agent can pass for one.
        if (userName.toLowerCase() == HELPER_AGENT_NAME.toLowerCase())
            return {error: `The name "${userName}" is taken. Choose another.`};
        const nameHolders = await DBSearchUtil.users.withUserName(userName);
        if (!nameHolders.success)
            return {error: "The name couldn't be checked. Try again later."};
        if (nameHolders.data.length > 0)
            return {error: `The name "${userName}" is taken. Choose another.`};

        // Charged last, so that trying names costs nothing. Agents share the guests' per-IP account caps.
        if (!GuestCreationLimitUtil.allowGuestCreation(ip, userAgent))
            return {error: "Too many new accounts from this address. Try again in an hour."};

        const secret = AgentKeyUtil.createSecret();
        const source = AcquisitionSourceUtil.normalize(ref != undefined && ref.length > 0
            ? `${AGENT_ACQUISITION_SOURCE_PREFIX}-${ref}` : AGENT_ACQUISITION_SOURCE_PREFIX);
        const created = await DBUserUtil.createUser(userName, UserTypeEnumMap.Agent, "", "", source,
            AgentKeyUtil.hashSecret(secret));
        if (!created.success || created.data.length == 0)
            return {error: "The account couldn't be created. Try again later."};

        return {key: AgentKeyUtil.toKey(created.data[0].id, secret), userName};
    },
    // The agent a key belongs to, or undefined.
    findByKey: async (key: string): Promise<DBUser | undefined> =>
    {
        const parsed = AgentKeyUtil.parse(key.trim());
        if (parsed == undefined)
            return undefined;

        const dbUser = await DBUserUtil.findUserById(parsed.userID);
        if (dbUser == null || dbUser.userType != UserTypeEnumMap.Agent)
            return undefined;
        return AgentKeyUtil.matches(parsed.secret, dbUser.agentKeyHash ?? "") ? dbUser : undefined;
    },
}

export default AgentAccountUtil;
