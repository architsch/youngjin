import Vec3 from "../../../../math/types/vec3";

// A part as pre_encoding_source.json spells it out for DefaultCompositionCodec (see PreEncodingSourceUtil).
export default interface PreEncodingSourcePart
{
    geometryId: string,
    materialId: string,
    dir: Vec3,
    offset: Vec3,
    scale: Vec3,
    color?: Vec3,
    mouldingColor?: Vec3,
    mouldingThickness?: number,
    mouldingIsConvex?: boolean,
}
