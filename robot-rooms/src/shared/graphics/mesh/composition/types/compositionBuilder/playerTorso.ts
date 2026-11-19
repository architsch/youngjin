import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS } from "../compositionConstants/playerCompositionConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const d = SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS;

// Kept within x = ±2 where the arms hang (but for a round side's stick-out), and full width at the top, where they
// attach.

export class PlayerTorso_0 extends PlayerCompositionBuilder // box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 4, y: 8, z: 4}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_0"] =
    (params, parts) => new PlayerTorso_0(params, parts);

export class PlayerTorso_1 extends PlayerCompositionBuilder // upward-facing cylinder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addUpwardFacingCylinder(ZERO_VEC3, {x: d, y: d, z: 8}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_1"] =
    (params, parts) => new PlayerTorso_1(params, parts);

export class PlayerTorso_2 extends PlayerCompositionBuilder // wide box, narrow box
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 2, z: 0}, {x: 4, y: 4, z: 4}, this.params.colors.torso);
        this.addBox({x: 0, y: -2, z: 0}, {x: 3, y: 4, z: 3}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_2"] =
    (params, parts) => new PlayerTorso_2(params, parts);

export class PlayerTorso_3 extends PlayerCompositionBuilder // chest, narrow waist, hips
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox({x: 0, y: 2.25, z: 0}, {x: 4, y: 3.5, z: 4}, this.params.colors.torso);
        this.addBox({x: 0, y: -0.75, z: 0}, {x: 2.5, y: 2.5, z: 2.5}, this.params.colors.torso);
        this.addBox({x: 0, y: -3, z: 0}, {x: 4, y: 2, z: 3}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_3"] =
    (params, parts) => new PlayerTorso_3(params, parts);

export class PlayerTorso_4 extends PlayerCompositionBuilder // wide upward-facing cylinder, narrow one below
{
    override run(): InstancedMeshCompositionBuilder
    {
        // Split below the middle, where the arms' undersides aren't: the wide one sticks out under them.
        this.addUpwardFacingCylinder({x: 0, y: 1.75, z: 0}, {x: d, y: d, z: 4.5}, this.params.colors.torso);
        this.addUpwardFacingCylinder({x: 0, y: -2.25, z: 0}, {x: 2.5, y: 2.5, z: 3.5}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_4"] =
    (params, parts) => new PlayerTorso_4(params, parts);

export class PlayerTorso_5 extends PlayerCompositionBuilder // bellows: wide boxes with narrow ones between
{
    override run(): InstancedMeshCompositionBuilder
    {
        for (let y = -3; y <= 3; y += 3)
            this.addBox({x: 0, y, z: 0}, {x: 4, y: 2, z: 4}, this.params.colors.torso);
        for (let y = -1.5; y <= 1.5; y += 3)
            this.addBox({x: 0, y, z: 0}, {x: 3, y: 1, z: 3}, this.params.colors.torso);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerTorso_5"] =
    (params, parts) => new PlayerTorso_5(params, parts);