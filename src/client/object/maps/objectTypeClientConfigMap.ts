import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTypeClientConfig from "../types/objectTypeClientConfig/objectTypeClientConfig";

// What each type of GameObject amounts to on the client: how one is built, and what picking one out
// amounts to (see ObjectTypeClientConfig). The shared ObjectTypeConfigMap is the other half — what
// each kind of object *is*, which the server reads too — and the two are filed under the same type
// names, so an object's index names its config in both.
//
// Each type's config files itself here as its own module loads, rather than this map reaching out
// for them. A config names the class it builds and the panel of tools it raises, and every one of
// those is downstream of the click, selection and camera code that reads this map back — so a map
// that imported them would close a cycle around the whole object system. Keeping this file free of
// them is what lets `GameObject` itself ask what a click on one of its own kind should do.
// `objectTypeClientConfigMapDependencies` is what pulls the configs in.
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
