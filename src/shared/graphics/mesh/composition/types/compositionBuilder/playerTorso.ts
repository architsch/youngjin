import { SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

const d = SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS;

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