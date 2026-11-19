import AudioClip from "./audioClip";
import AudioStream from "./audioStream";

// The clips there are, as AudioBundleBuilder made them (see AudioBundleMap): those cut from the one bundled file, and those
// streamed from files of their own.
export default interface AudioBundleInfo
{
    // Under the static site's assets; empty while the bundle holds no clip, and there is no file.
    path: string;
    // Changes whenever the file does, so that a cached copy of an older file is never cut by a newer map.
    version: string;
    // Where the click lies that shows how much a decoder shifts the clips (see AudioBundleUtil.findMarkerOffset).
    markerTime: number;
    clips: {readonly [name: string]: AudioClip};
    streams: {readonly [name: string]: AudioStream};
}
