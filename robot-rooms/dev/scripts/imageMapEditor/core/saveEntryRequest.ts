import ImageEntry from "./imageEntry";
import ImageRecipe from "./imageRecipe";

// A page's save: the entry's fields, and the recipe when it was sampled again (the server renders the sample
// from it).
export default interface SaveEntryRequest
{
    // An existing entry's path, or undefined for a new entry in subfolder.
    path: string | undefined;
    subfolder: string;
    fields: Omit<ImageEntry, "path" | "preserveScale">;
    recipe?: ImageRecipe;
    // The state the page edited, which must still be the current one.
    baseHash: string;
}
