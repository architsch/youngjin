// What PreEncodedCompositionBuilder generated in this build.
export default interface PreEncodedCompositions
{
    encodedStrings: string[];
    // Positions in encodedStrings per object type, in source order.
    indicesByObjectType: {[objectType: string]: number[]};
}
