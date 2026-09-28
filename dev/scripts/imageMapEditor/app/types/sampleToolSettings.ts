import SampleTool from "./sampleTool";
import RecipeSelection from "../../core/recipeSelection";

// The sample's tools as last set, kept across entries.
export default interface SampleToolSettings
{
    tool: SampleTool;
    // In percent of the sample's shorter side.
    brushRadius: number;
    // CIELAB distance, for taking out a color.
    colorTolerance: number;
    // Taken-out pixels tinted instead of see-through.
    showRemoved: boolean;
    // The shape a new selection is drawn in.
    selectShape: RecipeSelection["shape"];
}
