import ImageRecipe from "./imageRecipe";

// The editor's own record beside the map: how each entry was made, and the paths no entry may take again.
export default interface RecipeFile
{
    // Paths of deleted entries. A stored canvas or prop may still name one, so it must never show another image.
    retiredPaths: string[];
    recipes: {[path: string]: ImageRecipe};
}
