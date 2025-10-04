import ObjectTransform from "./objectTransform";

export default interface ObjectSpawnParams
{
    sourceUserName: string,
    objectType: string,
    objectId: string,
    transform: ObjectTransform,
}