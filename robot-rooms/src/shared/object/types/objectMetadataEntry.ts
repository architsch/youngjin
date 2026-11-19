import User from "../../user/types/user";

export default interface ObjectMetadataEntry
{
    // What a value is stored as. currentValue: what the object holds under the key as the value is set, for a key
    // only part of which a setting changes; absent as an object is added.
    preprocessingMethod: (rawValue: string, currentValue?: string) => string;
    // Who may set the key on any object, on top of the object type's own rule (see
    // ObjectTypeConfig.canUserSetObjectMetadata). Absent means whoever the type allows.
    canUserSet?: (user: User) => boolean;
    // Whether the key belongs to no type, so whoever canUserSet allows may set it on an object of any (the type's
    // own rule isn't asked). Absent means the type's rule is asked too.
    appliesToAnyType?: boolean;
}
