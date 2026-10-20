import Vec3 from "../../math/types/vec3";

// An NPC's Facing: which way across the floor a helper faces as the server plays it (see HelperAgentUtil), shown to its
// room and never kept. Whole degrees clockwise from north (-z, toward row 0) as seen from above. Decoding is total (a
// value that isn't a number reads as none), so the value needs no validation beyond canonicalize.
const NpcFacingUtil =
{
    decode: (str: string): number | undefined =>
    {
        const degrees = parseInt(str.trim());
        return isNaN(degrees) ? undefined : wrap(degrees);
    },
    encode: (degrees: number): string =>
    {
        return `${wrap(Math.round(degrees))}`;
    },
    canonicalize: (str: string): string =>
    {
        const degrees = NpcFacingUtil.decode(str);
        return (degrees == undefined) ? "" : NpcFacingUtil.encode(degrees);
    },
    // The way a direction points across the floor, its height aside, to the whole degree a Facing holds; and back.
    getDegrees: (dir: Vec3): number =>
    {
        return wrap(Math.round(Math.atan2(dir.x, -dir.z) * 180 / Math.PI));
    },
    getDir: (degrees: number): Vec3 =>
    {
        const radians = degrees * Math.PI / 180;
        return {x: Math.sin(radians), y: 0, z: -Math.cos(radians)};
    },
    // The turn from one facing to another the short way round, clockwise positive.
    getTurn: (from: number, to: number): number =>
    {
        const turn = wrap(to - from);
        return (turn > 180) ? turn - 360 : turn;
    },
}

function wrap(degrees: number): number
{
    return ((degrees % 360) + 360) % 360;
}

export default NpcFacingUtil;
