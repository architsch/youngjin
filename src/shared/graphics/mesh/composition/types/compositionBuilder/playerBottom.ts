import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const wheelColor: Vec3 = {x: 127, y: 127, z: 127};

class PlayerBottom_0 extends PlayerCompositionBuilder // external 1-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 0, z: 0}, {x: 4, y: 1, z: 2}, this.params.colors.bottom); // base
        this.addBox({x: 0, y: 1.25, z: 0}, {x: 2, y: 1.5, z: 2}, this.params.colors.bottom); // support
        for (let x = -2.5; x <= 2.5; x += 5)
            this.addSideFacingCylinder({x, y: 0, z: 0}, {x: 4, y: 4, z: 1}, wheelColor); // wheels
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_0"] =
    (params, parts) => new PlayerBottom_0(params, parts);

class PlayerBottom_1 extends PlayerCompositionBuilder // external 2-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.5, z: 0}, {x: 4, y: 1, z: 4}, this.params.colors.bottom); // base
        this.addBox({x: 0, y: 1, z: 0}, {x: 2, y: 2, z: 2}, this.params.colors.bottom); // support
        for (let x = -2.5; x <= 2.5; x += 5)
            for (let z = -1.5; z <= 1.5; z += 3)
                this.addSideFacingCylinder({x, y: -0.5, z}, {x: 3, y: 3, z: 1}, wheelColor); // wheels
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_1"] =
    (params, parts) => new PlayerBottom_1(params, parts);

class PlayerBottom_2 extends PlayerCompositionBuilder // external 3-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: -0.5, z: 0}, {x: 4, y: 2, z: 5}, this.params.colors.bottom); // base
        this.addBox({x: 0, y: 1.25, z: 0}, {x: 2, y: 1.5, z: 2}, this.params.colors.bottom); // support
        for (let x = -2.5; x <= 2.5; x += 5)
            for (let z = -2; z <= 2; z += 2)
                this.addSideFacingCylinder({x, y: -1, z}, {x: 2, y: 2, z: 1}, wheelColor); // wheels
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_2"] =
    (params, parts) => new PlayerBottom_2(params, parts);