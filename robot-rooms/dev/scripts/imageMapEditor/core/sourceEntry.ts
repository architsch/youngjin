import SourcePrep from "./sourcePrep";

// A source photo in the library (see SourceLibrary), which recipes name by sha1. What is known of where it came
// from carries over to an entry sampled from it.
export default interface SourceEntry
{
    sha1: string;
    fileName: string;
    // Upright, in pixels.
    width: number;
    height: number;
    // The page it came from, which it can be downloaded again from.
    url?: string;
    author?: string;
    license?: string;
    // When it was first added (ISO 8601): the index lists sources by name, so nothing else tells.
    addedAt: string;
    // For one preprocessed from another source (see SourcePreprocessor): that source, whose address, author and
    // license it carries, and how it was made, so it can be made again another way.
    preparedFrom?: {sha1: string, prep: SourcePrep};
}
