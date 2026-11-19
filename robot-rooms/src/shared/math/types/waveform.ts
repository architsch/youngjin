import { WaveformShape } from "./waveformShape";

// A level that repeats over time, such as how fast a fan turns. Written once and evaluated wherever it is
// needed, the same way on the CPU (WaveformUtil) and in shaders (waveformGLSL), so nothing has to be
// updated per frame to animate it.
export default interface Waveform
{
    shape: WaveformShape;
    low: number;
    high: number;
    frequency: number; // cycles per second
    phase: number; // how far into a cycle it is at time 0, in cycles
    duty: number; // pulse only: the share of each cycle the pulse lasts, in (0, 1]
}
