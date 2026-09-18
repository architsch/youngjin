import Vec3 from "../../../../../math/types/vec3";
import { FORWARD_DIR, INSTANCED_EMISSIVE_MATERIAL_ID,
    INSTANCED_TIN_MATERIAL_ID } from "../../../../../system/sharedConstants";
import { UNIT_PLAYER_PART_LENGTH } from "../compositionConstants/playerCompositionConstants";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// Solid forms use aged tin; the face squares use the unlit emissive material (flat paint look),
// shared with lamp faces to save a draw call.
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
        // Face colors are drawn unlit (see PlayerCompositionCodec), so they are kept dim (full strength
        // would read as lights); the eye background is lifted off black so it doesn't look like a hole.
        //
        // Background for the eyes (0.01 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x, y: offsetInUnits.y, z: offsetInUnits.z - 0.01},
            {x: 3, y: 1, z: 1}, {x: 32, y: 32, z: 32});
        // Eye 1 (0.02 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x + 0.75, y: offsetInUnits.y, z: offsetInUnits.z - 0.02},
            {x: 0.75, y: 0.6, z: 1}, {x: 24, y: 150, z: 24});
        // Eye 2 (0.02 = offset to prevent z-fighting)
        this.addSquare(
            {x: offsetInUnits.x - 0.75, y: offsetInUnits.y, z: offsetInUnits.z - 0.02},
            {x: 0.75, y: 0.6, z: 1}, {x: 24, y: 150, z: 24});
    }

    protected addBox(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, "Box", INSTANCED_TIN_MATERIAL_ID, color);
    }
    protected addUpwardFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, "Cylinder", INSTANCED_TIN_MATERIAL_ID, color,
            {x: 0, y: 1, z: 0});
    }
    protected addForwardFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, "Cylinder", INSTANCED_TIN_MATERIAL_ID, color);
    }
    protected addSideFacingCylinder(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, "Cylinder", INSTANCED_TIN_MATERIAL_ID, color,
            {x: 1, y: 0, z: 0});
    }
    protected addSquare(offsetInUnits: Vec3, scaleInUnits: Vec3, color: Vec3)
    {
        this.addPart(offsetInUnits, scaleInUnits, "Square", INSTANCED_EMISSIVE_MATERIAL_ID, color);
    }
    protected addPart(offsetInUnits: Vec3, scaleInUnits: Vec3,
        geometryId: string, materialId: string, color: Vec3, dir?: Vec3)
    {
        this.addPartRelativeToBase({
            geometryId,
            materialId,
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