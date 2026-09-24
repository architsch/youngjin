// FontFaceSet's add, which TypeScript declares only through the Set<FontFace> it extends in the DOM iterable
// lib (not among this project's libs).

interface FontFaceSet
{
    add(font: FontFace): FontFaceSet;
}
