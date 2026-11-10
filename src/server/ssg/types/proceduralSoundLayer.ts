// One part of a sound ProceduralSoundUtil makes: a tone or a filtered noise, shaped by an envelope that rises over its
// attack and then falls by its decay (the time it takes to fall to a third, about). Seconds and hertz.
export default interface ProceduralSoundLayer
{
    delay?: number; // after the sound starts; 0 if absent
    attack: number;
    decay: number; // Infinity holds it
    gain: number;
    // Its frequency as it starts and where it glides to (exponentially, over glide seconds), and the partials over it, as
    // ratios to it, each with a gain and a decay of its own (the layer's if absent). A sine alone if none is given.
    tone?: {frequency: [number, number], glide?: number, partials?: {ratio: number, gain: number, decay?: number}[]};
    // White noise through a filter whose cutoff (or center, for a band) glides as a tone's frequency does. crackle: grains
    // a second, each a short burst, which the noise is made of in place of a steady hiss.
    noise?: {filter: "lowpass" | "bandpass" | "highpass", frequency: [number, number], glide?: number, q?: number,
        crackle?: number};
    // A swell and ebb of its level, rate times a second, by depth (0 to 1). A loop's goes round a whole number of times in
    // the loop's length, so that it repeats seamlessly.
    wobble?: {rate: number, depth: number};
}
