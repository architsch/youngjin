import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

class PlayerHat_0 extends PlayerCompositionBuilder // narrow box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 0.5, y: 2, z: 0.5}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_0"] =
    (params, parts) => new PlayerHat_0(params, parts);

class PlayerHat_1 extends PlayerCompositionBuilder // narrow cylinder, wide cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addUpwardFacingCylinder({x: 0, y: -0.125, z: 0}, {x: 3, y: 3, z: 1.25}, this.params.colors.hat);
        this.addUpwardFacingCylinder({x: 0, y: -0.875, z: 0}, {x: 6, y: 6, z: 0.25}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_1"] =
    (params, parts) => new PlayerHat_1(params, parts);

class PlayerHat_2 extends PlayerCompositionBuilder // wide box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.5, z: 0}, {x: 3, y: 1, z: 3}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_2"] =
    (params, parts) => new PlayerHat_2(params, parts);