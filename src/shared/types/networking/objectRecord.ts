import ObjectTransform from "./objectTransform";

export default interface ObjectRecord
{
    objectType: string,
    objectId: string,
    transform: ObjectTransform,
}