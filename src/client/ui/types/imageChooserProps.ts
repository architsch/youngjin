export default interface ImageChooserProps
{
    title: string;
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
}
