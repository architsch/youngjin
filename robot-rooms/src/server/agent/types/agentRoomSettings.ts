// A room's settings as an agent reads and changes them (see AgentRoomSettingsUtil): the texture pack, and groups of
// settings named after the browser's customize-room panel, each a color ("#rrggbb") or a level from 0 to 100.
export default interface AgentRoomSettings
{
    texture_pack?: string;
    [group: string]: {[setting: string]: string | number | undefined} | string | undefined;
}
