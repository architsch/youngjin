// What plays a voice's clips into its output (see AudioVoice): cut from the decoded bundle, or streamed. It tells the voice
// once its one clip has played through, and once it has nothing left playing.
export default interface AudioClipPlayer
{
    // At once.
    start(): void;
    // At the context's time when, by which the voice has faded it out.
    stop(when: number): void;
}
