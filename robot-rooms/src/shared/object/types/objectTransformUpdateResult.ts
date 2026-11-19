import ObjectTransform from "./objectTransform";

export default interface ObjectTransformUpdateResult
{
    transform: ObjectTransform;
    desyncDetected: boolean;
}