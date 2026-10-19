export type UserType = number;

export const UserTypeEnumMap: Record<string, number> =
{
    Admin: 0,
    Member: 1,
    Guest: 2,
    // An AI agent playing over the MCP endpoint (see @docs/networking/agents.md).
    Agent: 3,
}