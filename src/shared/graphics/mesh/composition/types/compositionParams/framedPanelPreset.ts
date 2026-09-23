import FramedPanelCompositionParams from "./framedPanelCompositionParams";

// An authored look for a framed panel. A preset that leaves out whether it is framed, and its margin, is a
// finish alone, and applying it leaves those as they are.
type FramedPanelPreset = Omit<FramedPanelCompositionParams, "framed" | "margin">
    & Partial<Pick<FramedPanelCompositionParams, "framed" | "margin">>;

export default FramedPanelPreset;
