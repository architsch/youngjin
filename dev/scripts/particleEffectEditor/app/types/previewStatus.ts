// What the preview shows around its canvas, a few times a second.
export default interface PreviewStatus
{
    mode: "oneShot" | "emitter"; // as it plays now ("auto" resolved)
    previewable: boolean; // false while the effect has problems
    time: number; // since the effect last started
    duration: number; // until a one-shot effect's last particle dies
    frozen: boolean; // held at a moment picked on the timeline
    particles: number;
    overwrites: number;
    drawCalls: number; // the particles' own
    warnings: string[]; // what the particle system logged since the effect last started
}
