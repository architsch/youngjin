import { useCallback, useState } from "react";
import App from "../../../app";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import ScrollPanel from "./scrollPanel";
import TexturePackPanel from "./texturePackPanel";
import RestrictedZonesPanel from "./restrictedZonesPanel";
import AmbientLightPanel from "./ambientLightPanel";
import HeadLightPanel from "./headLightPanel";
import FogPanel from "./fogPanel";
import SmokePanel from "./smokePanel";
import SkyPanel from "./skyPanel";
import GroundPanel from "./groundPanel";
import InitialJoinPriorityPanel from "./initialJoinPriorityPanel";
import TexturePackSection, { TEXTURE_PACK_BUTTON_ID } from "./section/texturePackSection";
import RestrictedZonesSection, { RESTRICTED_ZONES_BUTTON_ID } from "./section/restrictedZonesSection";
import AmbientLightSection, { AMBIENT_LIGHT_BUTTON_ID } from "./section/ambientLightSection";
import HeadLightSection, { HEAD_LIGHT_BUTTON_ID } from "./section/headLightSection";
import FogSection, { FOG_BUTTON_ID } from "./section/fogSection";
import SmokeSection, { SMOKE_BUTTON_ID } from "./section/smokeSection";
import SkySection, { SKY_BUTTON_ID } from "./section/skySection";
import GroundSection, { GROUND_BUTTON_ID } from "./section/groundSection";
import InitialJoinPrioritySection, { INITIAL_JOIN_PRIORITY_BUTTON_ID } from "./section/initialJoinPrioritySection";

// Room settings (texture pack, restricted zones, lighting, and a hub's join priority). A panel, not a
// popup, so the room stays visible while edits apply immediately. The row only names settings; each
// opens its own panel hung from its toggle (see ScrollPanel), one at a time. Access is decided by
// TopBarMenu and the server.

export default function CustomizeRoomPanel({ onClose }: Props)
{
    // Which setting's panel is up, known by the toggle it hangs from.
    const [openButtonId, setOpenButtonId] = useState<string | null>(null);
    const toggleSubPanel = useCallback((buttonId: string) => {
        setOpenButtonId(prev => prev == buttonId ? null : buttonId);
    }, []);
    const closeSubPanel = useCallback(() => setOpenButtonId(null), []);

    // Only hubs are balanced between, so only they are ordered (see @docs/networking/room_population.md).
    const isHub = App.getCurrentRoom()?.roomType == RoomTypeEnumMap.Hub;

    // Bottom of the screen (other bottom UI stands down; see UIRoot), below popups.
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
            {isHub && <>
                <div className={DIVIDER_CLASS_NAMES}/>
                <InitialJoinPrioritySection open={openButtonId == INITIAL_JOIN_PRIORITY_BUTTON_ID}
                    onToggle={() => toggleSubPanel(INITIAL_JOIN_PRIORITY_BUTTON_ID)}/>
            </>}
        </ScrollPanel>
        {/* Outside the row, so dragging a sub-panel doesn't also scroll the row (see ScrollPanel). */}
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
        {isHub && openButtonId == INITIAL_JOIN_PRIORITY_BUTTON_ID &&
            <InitialJoinPriorityPanel anchorElementId={INITIAL_JOIN_PRIORITY_BUTTON_ID} onClose={closeSubPanel}/>}
    </div>;
}

// Rules between entries (as in CustomizePlayerPanel).
const DIVIDER_CLASS_NAMES = "w-px self-stretch shrink-0 bg-gray-500";

interface Props
{
    onClose: () => void;
}
