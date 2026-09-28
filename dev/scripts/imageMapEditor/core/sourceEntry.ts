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
}
