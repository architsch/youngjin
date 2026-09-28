import ImageRecipe from "../../core/imageRecipe";

// The entry being edited: what a save sends (see SaveEntryRequest), undoable as a whole.
export default interface Draft
{
    // An existing entry's path, or undefined for a new entry.
    path: string | undefined;
    subfolder: string;
    title: string;
    author: string;
    // As typed, comma-separated; "" to be found by the title and author (see ImageEntry).
    keywords: string;
    source: string;
    // "" for original artwork (see IMAGE_LICENSES).
    license: string;
    disabled: boolean;
    recipe: ImageRecipe;
}
