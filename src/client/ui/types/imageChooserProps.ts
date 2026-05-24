export default interface ImageChooserProps
{
    title: string;
    viewType: "grid" | "list";
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
}
