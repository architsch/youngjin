import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";
import PlayerCompositionBuilder from "./playerCompositionBuilder";

class PlayerNeckAndWaist extends PlayerCompositionBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        this.addBox(ZERO_VEC3, {x: 1.8, y: 1, z: 1.8}, {x: 127, y: 127, z: 127}); // gray box
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PlayerNeckAndWaist"] =
    (params, parts) => new PlayerNeckAndWaist(params, parts);