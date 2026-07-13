import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

class PlayerEar_0 extends PlayerCompositionBuilder // box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 1, y: 2, z: 2}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_0"] =
    (params, parts) => new PlayerEar_0(params, parts);

class PlayerEar_1 extends PlayerCompositionBuilder // cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addSideFacingCylinder(ZERO_VEC3, {x: 2, y: 2, z: 1}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_1"] =
    (params, parts) => new PlayerEar_1(params, parts);

class PlayerEar_2 extends PlayerCompositionBuilder // wide box, narrow box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: -0.25, y: 0, z: 0}, {x: 0.5, y: 2, z: 2}, this.params.colors.ear);
        this.addBox({x: 0.25, y: 0, z: 0}, {x: 0.5, y: 1, z: 1}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_2"] =
    (params, parts) => new PlayerEar_2(params, parts);