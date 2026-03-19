export default interface ObjectMetadataEntry
{
    preprocessingMethod: (rawValue: string) => string;
    unselectObjectOnSet: boolean;
}
