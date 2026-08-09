import { ReactNode } from "react";

export default interface ImageChooserProps
{
    title: string;
    id?: string; // DOM element id of the button that opens the chooser popup (e.g. so a coach mark can point at it)
    icon?: ReactNode; // icon of the button that opens the chooser popup (edit icon if undefined)
    viewType: "grid" | "list";
    mapName: string;
    initialChoicePath: string; // "" if no initial choice
    onChoose: (path: string) => void;
    onClick?: () => void;
}
