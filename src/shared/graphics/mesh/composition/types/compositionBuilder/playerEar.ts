import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

// The right ear, its inner side at x = -0.5 against the head; the left one is its mirror image.

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

class PlayerEar_3 extends PlayerCompositionBuilder // wide cylinder, narrow cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addSideFacingCylinder({x: -0.25, y: 0, z: 0}, {x: 3, y: 3, z: 0.5}, this.params.colors.ear);
        this.addSideFacingCylinder({x: 0.25, y: 0, z: 0}, {x: 1.5, y: 1.5, z: 0.5}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_3"] =
    (params, parts) => new PlayerEar_3(params, parts);

class PlayerEar_4 extends PlayerCompositionBuilder // box, antenna (a narrow box) rising from it
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.375, z: 0}, {x: 1, y: 1.25, z: 1.5}, this.params.colors.ear);
        this.addBox({x: 0, y: 1, z: 0}, {x: 0.5, y: 1.5, z: 0.5}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_4"] =
    (params, parts) => new PlayerEar_4(params, parts);

class PlayerEar_5 extends PlayerCompositionBuilder // wing: three boxes stepping up and back
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: -0.25, y: -0.5, z: 0}, {x: 0.5, y: 1, z: 2}, this.params.colors.ear);
        this.addBox({x: -0.25, y: 0.5, z: 0.875}, {x: 0.5, y: 1, z: 2.75}, this.params.colors.ear);
        this.addBox({x: -0.25, y: 1.375, z: 1.5}, {x: 0.5, y: 0.75, z: 2.5}, this.params.colors.ear);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerEar_5"] =
    (params, parts) => new PlayerEar_5(params, parts);