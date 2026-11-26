// What an emissive square draws within itself, lit in its own color, in place of that color all over (see
// instancedEmissiveShader).
type EmissiveGlyph =
    // A face on a dark screen. eyeOpen: how far its eyes are open, from shut (0) through open (1) to wide. eyeStyle: how
    // they are drawn (see EmissiveEyeStyleEnumMap). mouthCurve: how its mouth curves, from down (-1) through level (0)
    // to up (1). mouthOpen: how far its mouth is open, to an "O" (1). brightness: how much of its glow shows, from none
    // (0), a dark screen, to all of it (1). Of itself, it may blink now and then, let its eyes keep drooping shut, and
    // flicker on and off.
    | {kind: "face", eyeOpen: number, eyeStyle: number, mouthCurve: number, mouthOpen: number, brightness: number,
        blinks?: boolean, droops?: boolean, flickers?: boolean}
    // A battery lying on its side: its casing, and as many of its cells lit as its level, from none.
    | {kind: "battery", level: number};

export default EmissiveGlyph;
