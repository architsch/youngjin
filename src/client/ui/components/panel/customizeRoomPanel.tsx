import { useCallback, useState } from "react";
import ScrollPanel from "./scrollPanel";
import TexturePackPanel from "./texturePackPanel";
import RestrictedZonesPanel from "./restrictedZonesPanel";
import AmbientLightPanel from "./ambientLightPanel";
import HeadLightPanel from "./headLightPanel";
import FogPanel from "./fogPanel";
import SmokePanel from "./smokePanel";
import SkyPanel from "./skyPanel";
import GroundPanel from "./groundPanel";
import TexturePackSection, { TEXTURE_PACK_BUTTON_ID } from "./section/texturePackSection";
import RestrictedZonesSection, { RESTRICTED_ZONES_BUTTON_ID } from "./section/restrictedZonesSection";
import AmbientLightSection, { AMBIENT_LIGHT_BUTTON_ID } from "./section/ambientLightSection";
import HeadLightSection, { HEAD_LIGHT_BUTTON_ID } from "./section/headLightSection";
import FogSection, { FOG_BUTTON_ID } from "./section/fogSection";
import SmokeSection, { SMOKE_BUTTON_ID } from "./section/smokeSection";
import SkySection, { SKY_BUTTON_ID } from "./section/skySection";
import GroundSection, { GROUND_BUTTON_ID } from "./section/groundSection";

//------------------------------------------------------------------------
// A room's own settings — what the room *is*, as against what is in it: the texture pack its block
// work is finished in, the stretches of it kept to its superuser, and how it is lit and weathered.
//
// A panel rather than a popup, so that the room stays in view behind it: nearly every setting here is
// judged by looking at the room while it changes, and each is applied the moment it is made (see
// useEditableRoomPrefs), so there is nothing to confirm and nothing to close before seeing the result.
// It can be opened in either mode for the same reason: a room's light is as much a thing to walk
// about in as to look at from above.
//
// Laid out whole, the settings would stand as a wall of controls over the very room they adjust. So
// this panel only names them, in a single row no taller than one small button, and each setting's
// controls come up in a panel of their own, hung just above the row from the toggle beside its name
// (see ScrollPanel). One at a time: they would all hang in the same place, and two stacked up would
// leave little of the room to see what either of them does to it.
//
// Hub or private room, the settings are the same ones. Who may open them is decided where the button
// that does so is offered (see TopBarMenu), and whether a change is taken is the server's to decide.
//------------------------------------------------------------------------

export default function CustomizeRoomPanel({ onClose }: Props)
{
    // Which setting's panel is up, known by the toggle it hangs from.
    const [openButtonId, setOpenButtonId] = useState<string | null>(null);
    const toggleSubPanel = useCallback((buttonId: string) => {
        setOpenButtonId(prev => prev == buttonId ? null : buttonId);
    }, []);
    const closeSubPanel = useCallback(() => setOpenButtonId(null), []);

    // Anchored to the foot of the screen, over whatever else lives there (which stands down while this
    // is open — see UIRoot), and under any popup, since choosing a new texture pack opens one.
    return <div className="absolute bottom-0 inset-x-0 z-30 p-2 pointer-events-none">
        <ScrollPanel id="customizeRoomOptions" onClose={onClose}>
            <TexturePackSection open={openButtonId == TEXTURE_PACK_BUTTON_ID}
                onToggle={() => toggleSubPanel(TEXTURE_PACK_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <RestrictedZonesSection open={openButtonId == RESTRICTED_ZONES_BUTTON_ID}
                onToggle={() => toggleSubPanel(RESTRICTED_ZONES_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <AmbientLightSection open={openButtonId == AMBIENT_LIGHT_BUTTON_ID}
                onToggle={() => toggleSubPanel(AMBIENT_LIGHT_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <HeadLightSection open={openButtonId == HEAD_LIGHT_BUTTON_ID}
                onToggle={() => toggleSubPanel(HEAD_LIGHT_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <FogSection open={openButtonId == FOG_BUTTON_ID}
                onToggle={() => toggleSubPanel(FOG_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <SmokeSection open={openButtonId == SMOKE_BUTTON_ID}
                onToggle={() => toggleSubPanel(SMOKE_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <SkySection open={openButtonId == SKY_BUTTON_ID}
                onToggle={() => toggleSubPanel(SKY_BUTTON_ID)}/>
            <div className={DIVIDER_CLASS_NAMES}/>
            <GroundSection open={openButtonId == GROUND_BUTTON_ID}
                onToggle={() => toggleSubPanel(GROUND_BUTTON_ID)}/>
        </ScrollPanel>
        {/* Rendered beside the row rather than inside it, since each hangs from its toggle on its own
            (see ScrollPanel): inside, it would be part of the row, and a drag across it would scroll
            the row as well as itself. */}
        {openButtonId == TEXTURE_PACK_BUTTON_ID &&
            <TexturePackPanel anchorElementId={TEXTURE_PACK_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == RESTRICTED_ZONES_BUTTON_ID &&
            <RestrictedZonesPanel anchorElementId={RESTRICTED_ZONES_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == AMBIENT_LIGHT_BUTTON_ID &&
            <AmbientLightPanel anchorElementId={AMBIENT_LIGHT_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == HEAD_LIGHT_BUTTON_ID &&
            <HeadLightPanel anchorElementId={HEAD_LIGHT_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == FOG_BUTTON_ID &&
            <FogPanel anchorElementId={FOG_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == SMOKE_BUTTON_ID &&
            <SmokePanel anchorElementId={SMOKE_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == SKY_BUTTON_ID &&
            <SkyPanel anchorElementId={SKY_BUTTON_ID} onClose={closeSubPanel}/>}
        {openButtonId == GROUND_BUTTON_ID &&
            <GroundPanel anchorElementId={GROUND_BUTTON_ID} onClose={closeSubPanel}/>}
    </div>;
}

// Each setting's entry is set apart from the next by a rule rather than by a box of its own, as the
// character's parts are (see CustomizePlayerPanel).
const DIVIDER_CLASS_NAMES = "w-px self-stretch shrink-0 bg-gray-500";

interface Props
{
    onClose: () => void;
}
