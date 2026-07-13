import Vec3 from "../../../../../math/types/vec3";
import { FORWARD_DIR, UNIT_PLAYER_PART_LENGTH } from "../../../../../system/sharedConstants";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

export default class PlayerCompositionBuilder extends InstancedMeshCompositionBuilder
{
    run(): InstancedMeshCompositionBuilder
    {
        throw new Error("PlayerCompositionBuilder :: Method 'run' must be overriden by its child class.");
    }

    override offset(xInUnits: number, yInUnits: number, zInUnits: number): InstancedMeshCompositionBuilder
    {
        return super.offset(
            xInUnits * UNIT_PLAYER_PART_LENGTH,
            yInUnits * UNIT_PLAYER_PART_LENGTH,
            zInUnits * UNIT_PLAYER_PART_LENGTH
        );
    }
    
    protected addEyes(offsetInUnits: Vec3)
    {
        // Background for the eyes (0.01 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x, y: offsetInUnits.y, z: offsetInUnits.z - 0.01},
            {x: 3, y: 1, z: 1}, {x: 20, y: 20, z: 20});
        // Eye 1 (0.02 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x + 0.75, y: offsetInUnits.y, z: offsetInUnits.z - 0.02},
            {x: 0.75, y: 0.6, z: 1}, {x: 20, y: 230, z: 20});
        // Eye 2 (0.02 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x - 0.75, y: offsetInUnits.y, z: offsetInUnits.z - 0.02},
            {x: 0.75, y: 0.6, z: 1}, {x: 20, y: 230, z: 20});
    }

    protected addBox(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, this.params.ids.instancedMeshId_box, color);
    }
    protected addUpwardFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, this.params.ids.instancedMeshId_cylinder, color,
            {x: 0, y: 1, z: 0});
    }
    protected addForwardFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, this.params.ids.instancedMeshId_cylinder, color);
    }
    protected addSideFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, this.params.ids.instancedMeshId_cylinder, color,
            {x: 1, y: 0, z: 0});
    }
    protected addSquare(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, this.params.ids.instancedMeshId_square, color);
    }
    protected addPart(offsetInUnits: Vec3, scaleInUnits: Vec3,
        instancedMeshId: string, color: Vec3, dir?: Vec3)
    {
        this.addPartRelativeToBase({
            instancedMeshId,
            dir: dir ?? FORWARD_DIR,
            offset: {
                x: offsetInUnits.x * UNIT_PLAYER_PART_LENGTH,
                y: offsetInUnits.y * UNIT_PLAYER_PART_LENGTH,
                z: offsetInUnits.z * UNIT_PLAYER_PART_LENGTH,
            },
            scale: {
                x: scaleInUnits.x * UNIT_PLAYER_PART_LENGTH,
                y: scaleInUnits.y * UNIT_PLAYER_PART_LENGTH,
                z: scaleInUnits.z * UNIT_PLAYER_PART_LENGTH,
            },
            color,
        });
    }
}