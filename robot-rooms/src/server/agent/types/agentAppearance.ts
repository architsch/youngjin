// A character's look as an agent reads and changes it (see AgentAppearanceUtil): its parts by the names the browser's
// customize panel shows them under, each a shape (a number from 1, with what it is in a few words) and a color
// ("#rrggbb"); the eyes have a color only.
export default interface AgentAppearance
{
    [part: string]: {shape?: number, shape_name?: string, color?: string} | undefined;
}
