import FieldDomain from "./fieldDomain";

// One field an entry can author, by its dotted path within the params or the part.
export default interface CodecField
{
    path: string;
    domain: FieldDomain;
    // What the codec reads when the entry leaves the field out.
    defaultValue: any;
}
