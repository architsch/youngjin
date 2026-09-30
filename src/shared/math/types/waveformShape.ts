// How a Waveform rises and falls within one cycle (see WaveformUtil).
// - constant: always at its high level
// - sine: a smooth swing between its low and high levels
// - pulse: a smooth bump to its high level for the first part of each cycle (its duty), low otherwise
export type WaveformShape = "constant" | "sine" | "pulse";
