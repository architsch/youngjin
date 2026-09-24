import User from "../../user/types/user";

export default interface ObjectMetadataEntry
{
    preprocessingMethod: (rawValue: string) => string;
    // Who may set the key on any object, on top of the object type's own rule (see
    // ObjectTypeConfig.canUserSetObjectMetadata). Absent means whoever the type allows.
    canUserSet?: (user: User) => boolean;
}
