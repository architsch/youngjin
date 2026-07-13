import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

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