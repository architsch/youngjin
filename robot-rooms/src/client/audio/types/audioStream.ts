// A clip too long for the bundle, which plays from a file of its own as it downloads (see AudioBundleInfo).
export default interface AudioStream
{
    path: string; // under the static site's assets
    // Changes whenever the file does, so that a cached copy of an older one is never played.
    version: string;
}
