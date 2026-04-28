import { createContext, useContext } from "react";
import PopupState from "../types/popupState";

interface PopupContextValue
{
    open: (state: PopupState) => void;
    close: () => void;
}

export const PopupContext = createContext<PopupContextValue | null>(null);

export function usePopup(): PopupContextValue
{
    const ctx = useContext(PopupContext);
    if (!ctx)
        throw new Error("usePopup must be used inside a PopupContext.Provider");
    return ctx;
}
