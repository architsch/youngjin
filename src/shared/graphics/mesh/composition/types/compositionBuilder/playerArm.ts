import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

// The right arm, hanging from the shoulder (y = 3) beside the torso; the left one is its mirror image.

class PlayerArm_0 extends PlayerCompositionBuilder // box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 1, y: 6, z: 1}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_0"] =
    (params, parts) => new PlayerArm_0(params, parts);

class PlayerArm_1 extends PlayerCompositionBuilder // wide box, narrow box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 1.5, z: 0}, {x: 1, y: 3, z: 1}, this.params.colors.arm);
        this.addBox({x: 0, y: -1.5, z: 0}, {x: 0.5, y: 3, z: 0.5}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_1"] =
    (params, parts) => new PlayerArm_1(params, parts);

class PlayerArm_2 extends PlayerCompositionBuilder // wide box, narrow box, wide box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 2, z: 0}, {x: 1, y: 2, z: 1}, this.params.colors.arm);
        this.addBox({x: 0, y: -0.5, z: 0}, {x: 0.5, y: 3, z: 0.5}, this.params.colors.arm);
        this.addBox({x: 0, y: -2.5, z: 0}, {x: 0.75, y: 1, z: 0.75}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_2"] =
    (params, parts) => new PlayerArm_2(params, parts);

class PlayerArm_3 extends PlayerCompositionBuilder // round shoulder, pipe, round hand
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addSideFacingCylinder({x: 0, y: 2, z: 0}, {x: 2, y: 2, z: 1}, this.params.colors.arm);
        this.addUpwardFacingCylinder({x: 0, y: -0.25, z: 0}, {x: 1, y: 1, z: 3.5}, this.params.colors.arm);
        this.addSideFacingCylinder({x: 0, y: -2.25, z: 0}, {x: 1.5, y: 1.5, z: 1}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_3"] =
    (params, parts) => new PlayerArm_3(params, parts);

class PlayerArm_4 extends PlayerCompositionBuilder // upper arm, forearm held forward, fist
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 1.5, z: 0}, {x: 1, y: 3, z: 1}, this.params.colors.arm);
        this.addBox({x: 0, y: -0.375, z: -0.75}, {x: 0.75, y: 0.75, z: 2.5}, this.params.colors.arm);
        this.addBox({x: 0, y: -0.375, z: -2.5}, {x: 1, y: 1, z: 1}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_4"] =
    (params, parts) => new PlayerArm_4(params, parts);

class PlayerArm_5 extends PlayerCompositionBuilder // arm, wrist, pincer (two prongs, front and back)
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 1, z: 0}, {x: 0.75, y: 4, z: 0.75}, this.params.colors.arm);
        this.addBox({x: 0, y: -1.25, z: 0}, {x: 1, y: 0.5, z: 1.5}, this.params.colors.arm);
        for (let z = -0.5; z <= 0.5; z += 1)
            this.addBox({x: 0, y: -2.25, z}, {x: 0.5, y: 1.5, z: 0.5}, this.params.colors.arm);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerArm_5"] =
    (params, parts) => new PlayerArm_5(params, parts);