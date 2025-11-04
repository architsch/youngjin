import ObjectComponentGroupConfig from "./objectComponentGroupConfig";

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";

export default interface ObjectTypeConfig
{
    objectType: string;
    components: {[spawnType in SpawnType]?:
        ObjectComponentGroupConfig},
}