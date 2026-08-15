// A value a step gives to one of its actions or conditions, expressed as the way to arrive at the
// value rather than as the value itself.
//
// Most are constants and read as such — `col: () => 5` — while the rest look at where the user has
// actually got to: which patch of floor is worth pointing at, which way the camera happens to be
// turned, what an earlier step of the same mode worked out and set aside. That is what lets a step
// written long in advance point at something only known once it is being played.
type SinglePlayerParam<T> = () => T;

export default SinglePlayerParam;
