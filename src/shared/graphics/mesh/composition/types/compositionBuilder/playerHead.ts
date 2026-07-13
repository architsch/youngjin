import { SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS, SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const d = SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS;
const s = SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS;

class PlayerHead_0 extends PlayerCompositionBuilder // box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 4, y: 4, z: 4}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: -2});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_0"] =
    (params, parts) => new PlayerHead_0(params, parts);

class PlayerHead_1 extends PlayerCompositionBuilder // forward-facing cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addForwardFacingCylinder(ZERO_VEC3, {x: d, y: d, z: 4}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: -2});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_1"] =
    (params, parts) => new PlayerHead_1(params, parts);

class PlayerHead_2 extends PlayerCompositionBuilder // upward-facing cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addUpwardFacingCylinder(ZERO_VEC3, {x: d, y: d, z: 4}, this.params.colors.head);
        // Pad the player's face (front) with a box which provides a flat surface,
        // so as to be able to put the player's eyes on it.
        // (Explanation for "eyeHolderBoxCenterZ = -2 - s - 0.01 + 0.5"):
        //      2 + s = radius of the circle (cylinder's cross section)
        //      0.01 = slight offset to ensure that the front of the box won't z-fight with the cylinder's surface
        //      0.5 = offset to ensure that the resulting "z" value is at the center of the box's z-range (The box's size on the z-axis is 1)
        const eyeHolderBoxCenterZ = -2 - s - 0.01 + 0.5;
        this.addBox({x: 0, y: 0, z: eyeHolderBoxCenterZ}, {x: 3, y: 1, z: 1}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: eyeHolderBoxCenterZ - 0.5});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_2"] =
    (params, parts) => new PlayerHead_2(params, parts);