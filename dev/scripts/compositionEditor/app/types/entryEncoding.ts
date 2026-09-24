// An entry run through the build's encoder: the string it would generate, or the error that fails the build.
export default interface EntryEncoding
{
    encoded?: string;
    error?: string;
    // What the codecs logged without failing the build (e.g. a value outside the range it is stored in).
    warnings: string[];
}
