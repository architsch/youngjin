import { Dir4 } from "../types/dir4";
import Vec3 from "../types/vec3";

const DirUtil =
{
    dir4ToProperties: (dir: Dir4): {facingAxis: "x" | "y" | "z", orientation: "-" | "+"} =>
    {
        let facingAxis: "x" | "y" | "z";
        let orientation: "-" | "+";
        switch (dir)
        {
            case "+z": facingAxis = "z"; orientation = "+"; break;
            case "-z": facingAxis = "z"; orientation = "-"; break;
            case "+x": facingAxis = "x"; orientation = "+"; break;
            case "-x": facingAxis = "x"; orientation = "-"; break;
            default: throw new Error(`Unknown Dir4 :: ${dir}`);
        }
        return {facingAxis, orientation};
    },
    localDxToWorldDxDz: (dir: Dir4, localDx: number): {worldDx: number, worldDz: number} =>
    {
        switch (dir)
        {
            case "+z": return {worldDx: localDx, worldDz: 0};
            case "-z": return {worldDx: -localDx, worldDz: 0};
            case "+x": return {worldDx: 0, worldDz: -localDx};
            case "-x": return {worldDx: 0, worldDz: localDx};
            default: throw new Error(`Unknown Dir4 :: ${dir}`);
        }
    },
    dir4ToVec3: (dir: Dir4): Vec3 =>
    {
        switch (dir)
        {
            case "+z": return {x: 0, y: 0, z: 1};
            case "-z": return {x: 0, y: 0, z: -1};
            case "+x": return {x: 1, y: 0, z: 0};
            case "-x": return {x: -1, y: 0, z: 0};
            default: throw new Error(`Unknown Dir4 :: ${dir}`);
        }
    },
    vec3ToDir4: (v: Vec3): Dir4 =>
    {
        if (v.z > 0) return "+z";
        else if (v.z < 0) return "-z";
        else if (v.x > 0) return "+x";
        else if (v.x < 0) return "-x";
        else throw new Error(`Vec3 is not convertible to Dir4 :: vec3 = ${JSON.stringify(v)}`);
    },
    dir4ToNumber: (dir: Dir4): number =>
    {
        switch (dir)
        {
            case "+z": return 0;
            case "+x": return 1;
            case "-z": return 2;
            case "-x": return 3;
            default: throw new Error(`Unknown Dir4 :: ${dir}`);
        }
    },
    numberToDir4: (n: number): Dir4 =>
    {
        switch (n)
        {
            case 0: return "+z";
            case 1: return "+x";
            case 2: return "-z";
            case 3: return "-x";
            default: throw new Error(`Unknown number for Dir4 :: ${n}`);
        }
    },
    rotateCW: (dir: Dir4): Dir4 =>
    {
        return DirUtil.numberToDir4((DirUtil.dir4ToNumber(dir) + 1) % 4);
    },
    rotateCCW: (dir: Dir4): Dir4 =>
    {
        return DirUtil.numberToDir4((DirUtil.dir4ToNumber(dir) + 3) % 4);
    },
}

export default DirUtil;