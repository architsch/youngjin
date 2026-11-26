import AudioClip from "./audioClip";
import AudioStream from "./audioStream";

// The clips there are, as AudioBundleBuilder made them (see AudioBundleMap): those cut from the one bundled file, and those
// streamed from files of their own.
export default interface AudioBundleInfo
{
    // Under the static site's assets, in a file named by the version; empty while the bundle holds no clip, and there is
    // no file.
    path: string;
    // A hash of what the bundle holds: a new one is a new file, so a build still deployed goes on cutting its own.
    version: string;
    // Where the click lies that shows how much a decoder shifts the clips (see AudioBundleUtil.findMarkerOffset).
    markerTime: number;
    clips: {readonly [name: string]: AudioClip};
    streams: {readonly [name: string]: AudioStream};
}
