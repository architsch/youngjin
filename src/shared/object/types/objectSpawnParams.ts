import ObjectTransform from "./objectTransform";

export default interface ObjectSpawnParams
{
    sourceUserName: string,
    objectTypeIndex: number,
    objectId: string,
    transform: ObjectTransform,
    metadata: string,
}