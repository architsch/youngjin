import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS,
    SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS } from "../compositionConstants/playerCompositionConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const d = SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS;
const s = SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS;

// A box padding the front of a head that is round there, so the eyes have a flat surface.
// eyeHolderBoxCenterZ = -(2 + s) (circle radius) - 0.01 (anti-z-fight) + 0.5 (half the box depth)
const eyeHolderBoxCenterZ = -2 - s - 0.01 + 0.5;

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
        this.addBox({x: 0, y: 0, z: eyeHolderBoxCenterZ}, {x: 3, y: 1, z: 1}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: eyeHolderBoxCenterZ - 0.5});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_2"] =
    (params, parts) => new PlayerHead_2(params, parts);

class PlayerHead_3 extends PlayerCompositionBuilder // side-facing cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addSideFacingCylinder(ZERO_VEC3, {x: d, y: d, z: 4}, this.params.colors.head);
        this.addBox({x: 0, y: 0, z: eyeHolderBoxCenterZ}, {x: 3, y: 1, z: 1}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: eyeHolderBoxCenterZ - 0.5});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_3"] =
    (params, parts) => new PlayerHead_3(params, parts);

class PlayerHead_4 extends PlayerCompositionBuilder // wide band (eyes and ears on it) between narrow boxes
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 4, y: 2, z: 4}, this.params.colors.head);
        for (let y = -1.5; y <= 1.5; y += 3)
            this.addBox({x: 0, y, z: 0}, {x: 3, y: 1, z: 3}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: -2});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_4"] =
    (params, parts) => new PlayerHead_4(params, parts);

class PlayerHead_5 extends PlayerCompositionBuilder // wide band (eyes and ears on it) between upward-facing cylinders
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 4, y: 2, z: 4}, this.params.colors.head);
        for (let y = -1.5; y <= 1.5; y += 3)
            this.addUpwardFacingCylinder({x: 0, y, z: 0}, {x: 0.75 * d, y: 0.75 * d, z: 1}, this.params.colors.head);
        this.addEyes({x: 0, y: 0, z: -2});
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerHead_5"] =
    (params, parts) => new PlayerHead_5(params, parts);