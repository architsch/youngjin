import ProceduralSoundLayer from "./proceduralSoundLayer";

// A sound ProceduralSoundUtil makes, of layers played together.
export default interface ProceduralSoundSpec
{
    name: string; // the clip's (see AudioClipName)
    duration: number; // seconds; a loop's length
    peak: number; // the loudest sample, from 0 to 1
    // Repeats seamlessly: its end runs on into its start, and its paddings in the bundle hold its own other end.
    loop?: boolean;
    layers: ProceduralSoundLayer[];
}
