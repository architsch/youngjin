import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

// From the top of the head (y = -1) to the top of the player's collider (y = 1), where speech bubbles start.

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

class PlayerHat_3 extends PlayerCompositionBuilder // propeller cap: cylinder, post, blade
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addUpwardFacingCylinder({x: 0, y: -0.625, z: 0}, {x: 3, y: 3, z: 0.75}, this.params.colors.hat);
        this.addBox({x: 0, y: 0.125, z: 0}, {x: 0.5, y: 0.75, z: 0.5}, this.params.colors.hat);
        this.addBox({x: 0, y: 0.625, z: 0}, {x: 4, y: 0.25, z: 0.75}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_3"] =
    (params, parts) => new PlayerHat_3(params, parts);

class PlayerHat_4 extends PlayerCompositionBuilder // crown: thin wide box, a point at each corner
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.75, z: 0}, {x: 3.5, y: 0.5, z: 3.5}, this.params.colors.hat);
        for (let x = -1.5; x <= 1.5; x += 3)
            for (let z = -1.5; z <= 1.5; z += 3)
                this.addBox({x, y: 0.125, z}, {x: 0.5, y: 1.25, z: 0.5}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_4"] =
    (params, parts) => new PlayerHat_4(params, parts);

class PlayerHat_5 extends PlayerCompositionBuilder // crest: long narrow box, shorter one on top
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.5, z: 0}, {x: 0.5, y: 1, z: 3.5}, this.params.colors.hat);
        this.addBox({x: 0, y: 0.375, z: 0}, {x: 0.5, y: 0.75, z: 2}, this.params.colors.hat);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHat_5"] =
    (params, parts) => new PlayerHat_5(params, parts);