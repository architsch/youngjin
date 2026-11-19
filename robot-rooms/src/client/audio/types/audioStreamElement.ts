// A media element a stream plays through, and the node it feeds the context by, which can be made only once for it (see
// AudioStreamUtil).
export default interface AudioStreamElement
{
    element: HTMLAudioElement;
    node: MediaElementAudioSourceNode;
}
