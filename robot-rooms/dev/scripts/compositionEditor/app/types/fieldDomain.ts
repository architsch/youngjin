// What an authored field can hold, as read off its codec (see FieldDomainUtil).
type FieldDomain =
    | {kind: "choice", options: any[]} // a vector the codec stores whole: a palette color, a facing
    | {kind: "number", values: number[]} // the numbers the codec can store, ascending
    | {kind: "boolean"};

export default FieldDomain;
