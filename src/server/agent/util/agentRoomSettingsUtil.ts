import Room from "../../../shared/room/types/room";
import RoomPrefs from "../../../shared/room/types/roomPrefs";
import RoomPrefsUtil, { MAX_ROOM_PREFS_STEP } from "../../../shared/room/util/roomPrefsUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import ColorUtil from "../../../shared/math/util/colorUtil";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import { ATMOSPHERE_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME } from "../../../shared/system/sharedConstants";
import ServerRoomManager from "../../room/serverRoomManager";
import AgentUserContext from "../types/agentUserContext";
import AgentRoomSettings from "../types/agentRoomSettings";
import AgentRoomUtil from "./agentRoomUtil";

// A setting: a color from a palette, or a level (a step of the room's prefs, told as 0 to 100).
type Setting = {pref: keyof RoomPrefs, palette?: string};

// The customize-room panel's sections and their settings, by the names it shows them under (the hub order is an
// admin's, and left out).
const SETTINGS: {[group: string]: {[setting: string]: Setting}} = {
    ambient_light: {
        color: {pref: "ambientColorIndex", palette: LIGHT_COLOR_PALETTE_NAME},
        strength: {pref: "ambientIntensityStep"},
    },
    head_light: {
        color: {pref: "headLightColorIndex", palette: LIGHT_COLOR_PALETTE_NAME},
        power: {pref: "headLightPowerStep"},
        range: {pref: "headLightRangeStep"},
    },
    fog: {
        color: {pref: "fogColorIndex", palette: ATMOSPHERE_COLOR_PALETTE_NAME},
        near: {pref: "fogNearStep"},
        far: {pref: "fogFarStep"},
    },
    smoke: {
        strength: {pref: "fogSmokeAmplitudeStep"},
        scale: {pref: "fogSmokeScaleStep"},
        speed: {pref: "fogSmokeSpeedStep"},
        drift: {pref: "fogSmokeDriftStep"},
        rise: {pref: "fogSmokeRiseStep"},
    },
    sky: {
        color: {pref: "skyColorIndex", palette: ATMOSPHERE_COLOR_PALETTE_NAME},
        cloud_color: {pref: "cloudColorIndex", palette: ATMOSPHERE_COLOR_PALETTE_NAME},
        cloud_strength: {pref: "cloudOpacityStep"},
        cloud_scale: {pref: "cloudScaleStep"},
        cloud_softness: {pref: "cloudSoftnessStep"},
        cloud_speed: {pref: "cloudSpeedStep"},
    },
    ground: {
        color: {pref: "groundColorIndex", palette: ATMOSPHERE_COLOR_PALETTE_NAME},
        peaks: {pref: "groundPeakColorIndex", palette: ATMOSPHERE_COLOR_PALETTE_NAME},
        opacity: {pref: "groundSolidityStep"},
        scale: {pref: "groundScaleStep"},
        softness: {pref: "groundSoftnessStep"},
    },
};

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// How a room looks, as its owner sets it in the browser's customize-room panel: the same settings, by the same
// names, and through the same calls (see RoomRouter's room settings routes).
const AgentRoomSettingsUtil =
{
    // Each group's settings, and whether each is a color (else a level).
    getSettingKinds: (): {[group: string]: {[setting: string]: "color" | "level"}} =>
    {
        return Object.fromEntries(Object.entries(SETTINGS).map(([group, settings]) => [group,
            Object.fromEntries(Object.entries(settings).map(([name, setting]) =>
                [name, setting.palette != undefined ? "color" : "level"]))]));
    },
    getTexturePacks: (): string[] =>
    {
        return ImageMapUtil.getImageMap("VoxelTexturePackImageMap").getImageMetadataList().map(entry => entry.path);
    },
    look: (ctx: AgentUserContext): object =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: "You aren't in a room."};
        return {
            settings: describe(room),
            yours: RoomValidationUtil.userOwnsRoom(ctx.user, room),
            texture_packs: AgentRoomSettingsUtil.getTexturePacks(),
            // What the colors snap to: a light's color is one of these, ...
            light_colors: [...Array(ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME)).keys()]
                .map(index => toHex(LIGHT_COLOR_PALETTE_NAME, index)),
            // ... and the fog's, sky's, clouds' and ground's one of these.
            atmosphere_colors: [...Array(ColorUtil.getPaletteSize(ATMOSPHERE_COLOR_PALETTE_NAME)).keys()]
                .map(index => toHex(ATMOSPHERE_COLOR_PALETTE_NAME, index)),
            note: "Levels run from 0 to 100. A color given is changed to the nearest one its setting can take.",
        };
    },
    // In the agent's own room only, as in a browser. Fog's near never passes its far, as the panel keeps them.
    change: async (ctx: AgentUserContext, request: AgentRoomSettings): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: "You aren't in a room."};
        if (!RoomValidationUtil.userOwnsRoom(ctx.user, room))
            return {error: "Only your own room's settings can be changed (travel home first)."};

        const prefs = RoomPrefsUtil.decode(room.prefs);
        for (const [group, values] of Object.entries(request))
        {
            if (group == "texture_pack" || values == undefined || typeof values == "string")
                continue;
            for (const [name, value] of Object.entries(values))
            {
                const setting = SETTINGS[group]?.[name];
                if (setting == undefined || value == undefined)
                    continue;
                if (setting.palette != undefined)
                {
                    if (typeof value != "string" || !HEX_COLOR_PATTERN.test(value))
                        return {error: `${group}.${name} is a color, given as "#rrggbb".`};
                    prefs[setting.pref] = ColorUtil.rgbToPaletteIndex(setting.palette, ColorUtil.hexToRGB(value));
                }
                else
                {
                    prefs[setting.pref] = Math.round(Number(value) * MAX_ROOM_PREFS_STEP / 100);
                    if (setting.pref == "fogNearStep")
                        prefs.fogFarStep = Math.max(prefs.fogFarStep, prefs.fogNearStep);
                    else if (setting.pref == "fogFarStep")
                        prefs.fogNearStep = Math.min(prefs.fogNearStep, prefs.fogFarStep);
                }
            }
        }

        const texturePack = request.texture_pack;
        if (texturePack != undefined && texturePack != room.texturePackPath)
        {
            if (!AgentRoomSettingsUtil.getTexturePacks().includes(texturePack))
            {
                return {error: `There is no texture pack "${texturePack}". These are: `
                    + `${AgentRoomSettingsUtil.getTexturePacks().join(", ")}.`};
            }
            if (!await ServerRoomManager.changeRoomTexturePack(room, texturePack))
                return {error: "The texture pack couldn't be changed. Try again later."};
        }

        const encoded = RoomPrefsUtil.encode(prefs);
        if (encoded != room.prefs && !await ServerRoomManager.changeRoomPrefs(room, encoded))
            return {error: "The settings couldn't be changed. Try again later.", settings: describe(room)};
        return {settings: describe(room)};
    },
}

function describe(room: Room): AgentRoomSettings
{
    const prefs = RoomPrefsUtil.decode(room.prefs);
    const settings: AgentRoomSettings = {texture_pack: room.texturePackPath};
    for (const [group, groupSettings] of Object.entries(SETTINGS))
    {
        settings[group] = Object.fromEntries(Object.entries(groupSettings).map(([name, setting]) => [name,
            setting.palette != undefined ? toHex(setting.palette, prefs[setting.pref])
                : Math.round(prefs[setting.pref] * 100 / MAX_ROOM_PREFS_STEP)]));
    }
    return settings;
}

function toHex(palette: string, index: number): string
{
    return ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(palette, index));
}

export default AgentRoomSettingsUtil;
