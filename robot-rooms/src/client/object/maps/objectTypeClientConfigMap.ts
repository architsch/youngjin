import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTypeClientConfig from "../types/objectTypeClientConfig/objectTypeClientConfig";

// Client-only config per object type (see ObjectTypeClientConfig), keyed like the shared
// ObjectTypeConfigMap. Configs register themselves on load (pulled in by
// objectTypeClientConfigMapDependencies) because importing them here would create a cycle through
// GameObject.
const configByType: {[objectType: string]: ObjectTypeClientConfig} = {};

const ObjectTypeClientConfigMap =
{
    setConfig: (objectType: string, config: ObjectTypeClientConfig) =>
    {
        configByType[objectType] = config;
    },
    getConfigByType: (objectType: string): ObjectTypeClientConfig =>
    {
        const config = configByType[objectType];
        if (config == undefined)
            throw new Error(`getConfigByType :: Invalid object type (objectType = ${objectType})`);
        return config;
    },
    getConfigByIndex: (objectTypeIndex: number): ObjectTypeClientConfig =>
    {
        return ObjectTypeClientConfigMap.getConfigByType(
            ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).objectType);
    },
}

export default ObjectTypeClientConfigMap;
