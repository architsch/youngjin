import Vec3 from "../../../../../math/types/vec3";
import Vector3DUtil from "../../../../../math/util/vector3DUtil";
import { FORWARD_DIR, UNIT_VEC3, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";

export default abstract class InstancedMeshCompositionBuilder
{
    protected params: InstancedMeshCompositionParams;
    protected parts: InstancedMeshCompositionPart[];
    // The footprint the parts have to fill, in world units. Only a builder for a resizable type reads
    // it, and only that type's codec passes it; everything else is built at its authored size.
    protected objectSize: Vec3;
    protected baseDir: Vec3 = {...FORWARD_DIR};
    protected baseOffset: Vec3 = {...ZERO_VEC3};
    protected baseScale: Vec3 = {...UNIT_VEC3};
    protected mirroredX: boolean = false;

    constructor(params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[],
        objectSize: Vec3 = UNIT_VEC3)
    {
        this.params = params;
        this.parts = parts;
        this.objectSize = objectSize;
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

    // Reflects the parts across their x = 0 plane (e.g. a left limb built from a right one's design). Every
    // primitive is symmetric about its own axes, so reflecting each part's place and facing is enough.
    mirrored(): InstancedMeshCompositionBuilder
    {
        this.mirroredX = true;
        return this;
    }

    protected addPartRelativeToBase(part: InstancedMeshCompositionPart)
    {
        if (this.mirroredX)
        {
            part.offset = {x: -part.offset.x, y: part.offset.y, z: part.offset.z};
            part.dir = {x: -part.dir.x, y: part.dir.y, z: part.dir.z};
        }
        // Re-express the part's facing (authored against FORWARD_DIR) relative to baseDir.
        part.dir = Vector3DUtil.rotateFromTo(part.dir, FORWARD_DIR, this.baseDir);
        part.offset = Vector3DUtil.add(this.baseOffset,
            Vector3DUtil.rotateFromTo(part.offset, FORWARD_DIR, this.baseDir));
        part.scale = Vector3DUtil.mult(this.baseScale, part.scale);
        this.parts.push(part);
    }
}