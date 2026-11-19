import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const wheelColor: Vec3 = {x: 127, y: 127, z: 127};

// External wheels turn outside the body; internal ones turn inside a frame that holds their axles from both sides.

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

class PlayerBottom_3 extends PlayerCompositionBuilder // internal 1-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addSideFacingCylinder({x: 0, y: -0.25, z: 0}, {x: 3.5, y: 3.5, z: 3}, wheelColor); // wheel
        for (let side = -1; side <= 1; side += 2)
            this.addBox({x: side * 1.875, y: 0.625, z: 0}, {x: 0.25, y: 1.75, z: 1.5}, this.params.colors.bottom); // fork leg
        this.addBox({x: 0, y: 1.75, z: 0}, {x: 4, y: 0.5, z: 1.5}, this.params.colors.bottom); // crown
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_3"] =
    (params, parts) => new PlayerBottom_3(params, parts);

class PlayerBottom_4 extends PlayerCompositionBuilder // internal 2-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        for (let z = -1.5; z <= 1.5; z += 3)
        {
            this.addSideFacingCylinder({x: 0, y: -0.75, z}, {x: 2.5, y: 2.5, z: 3}, wheelColor); // wheel
            for (let side = -1; side <= 1; side += 2)
                this.addBox({x: side * 1.875, y: 0.125, z}, {x: 0.25, y: 1.75, z: 1}, this.params.colors.bottom); // fork leg
        }
        this.addBox({x: 0, y: 1.5, z: 0}, {x: 4, y: 1, z: 4}, this.params.colors.bottom); // frame
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_4"] =
    (params, parts) => new PlayerBottom_4(params, parts);

class PlayerBottom_5 extends PlayerCompositionBuilder // internal 3-wheel
{
    override run(): InstancedMeshCompositionBuilder
    {
        for (let z = -2; z <= 2; z += 2)
        {
            this.addSideFacingCylinder({x: 0, y: -1, z}, {x: 2, y: 2, z: 3}, wheelColor); // wheel
            for (let side = -1; side <= 1; side += 2)
                this.addBox({x: side * 1.875, y: -0.5, z}, {x: 0.25, y: 1, z: 0.75}, this.params.colors.bottom); // fork leg
        }
        this.addBox({x: 0, y: 0.25, z: 0}, {x: 4, y: 0.5, z: 4.75}, this.params.colors.bottom); // deck
        this.addBox({x: 0, y: 1.25, z: 0}, {x: 2, y: 1.5, z: 2}, this.params.colors.bottom); // support
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerBottom_5"] =
    (params, parts) => new PlayerBottom_5(params, parts);