import ImageEntry from "./imageEntry";
import ImageMapSubfolderTab from "../../../../src/shared/graphics/image/types/imageMapSubfolderTab";
import RecipeFile from "./recipeFile";
import SourceEntry from "./sourceEntry";

// The map as the editor's server reads it.
export default interface EditorState
{
    subfolders: ImageMapSubfolderTab[];
    entries: ImageEntry[];
    recipeFile: RecipeFile;
    // Of the manifest and recipes, so a save based on an older state is refused.
    hash: string;
    // The source library, which a save doesn't depend on.
    sources: SourceEntry[];
    // Where the files are, relative to the repository, for the header.
    manifestPath: string;
}
