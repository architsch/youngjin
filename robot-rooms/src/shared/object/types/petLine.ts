// Something a pet says in fixed words (see PetLineMap), and the mood it says it in, which its face shows: 1 for a
// pleasant one, which also calms it, -1 for a sorry one, 0 for neither.
type PetLine = {
    text: string,
    mood: number,
};

export default PetLine;
