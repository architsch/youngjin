export default interface PersistentObject
{
    objectId: string;
    objectTypeIndex: number;
    direction: "+z" | "+x" | "-z" | "-x";
    x: number;
    y: number;
    z: number;
    metadata: string;
}