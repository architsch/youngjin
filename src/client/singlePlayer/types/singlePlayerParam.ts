// A step input evaluated at play time, e.g. `col: () => 5` or a value computed from live state or an
// earlier step's variable.
type SinglePlayerParam<T> = () => T;

export default SinglePlayerParam;
