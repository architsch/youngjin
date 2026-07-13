import Vec3 from "../../../../../math/types/vec3";
import Vector3DUtil from "../../../../../math/util/vector3DUtil";
import { BACKWARD_DIR, FORWARD_DIR, UNIT_VEC3, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";

export default abstract class InstancedMeshCompositionBuilder
{
    protected params: InstancedMeshCompositionParams;
    protected parts: InstancedMeshCompositionPart[];
    protected baseDir: Vec3 = {...FORWARD_DIR};
    protected baseOffset: Vec3 = {...ZERO_VEC3};
    protected baseScale: Vec3 = {...UNIT_VEC3};

    constructor(params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[])
    {
        this.params = params;
        this.parts = parts;
    }

    abstract run(): InstancedMeshCompositionBuilder;

    dir(x: number, y: number, z: number): InstancedMeshCompositionBuilder
    {
        this.baseDir.x = x;
        this.baseDir.y = y;
        this.baseDir.z = z;
        return this;
    }
    offset(x: number, y: number, z: number): InstancedMeshCompositionBuilder
    {
        this.baseOffset.x = x;
        this.baseOffset.y = y;
        this.baseOffset.z = z;
        return this;
    }
    scale(x: number, y: number, z: number): InstancedMeshCompositionBuilder
    {
        this.baseScale.x = x;
        this.baseScale.y = y;
        this.baseScale.z = z;
        return this;
    }

    backward(): InstancedMeshCompositionBuilder
    {
        this.baseDir.x = BACKWARD_DIR.x;
        this.baseDir.y = BACKWARD_DIR.y;
        this.baseDir.z = BACKWARD_DIR.z;
        return this;
    }

    protected addPartRelativeToBase(part: InstancedMeshCompositionPart)
    {
        // Re-express the part's facing (authored against FORWARD_DIR) relative to baseDir.
        part.dir = Vector3DUtil.rotateFromTo(part.dir, FORWARD_DIR, this.baseDir);
        part.offset = Vector3DUtil.add(this.baseOffset, part.offset);
        part.scale = Vector3DUtil.mult(this.baseScale, part.scale);
        this.parts.push(part);
    }
}