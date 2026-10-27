import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import PlayerObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectCompositionUtil from "../../../shared/object/util/objectCompositionUtil";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import ColorUtil from "../../../shared/math/util/colorUtil";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import PlayerCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import PlayerCompositionParams from "../../../shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import Room from "../../../shared/room/types/room";
import AgentUserContext from "../types/agentUserContext";
import AgentAppearance from "../types/agentAppearance";
import AgentRoomUtil from "./agentRoomUtil";
import AgentSignalUtil from "./agentSignalUtil";
import AgentBudgetUtil from "./agentBudgetUtil";
import HelperAgentUtil from "./helperAgentUtil";

// The parts with a shape, by the names the customize panel shows them under, and their keys in the composition. The
// eyes, which come after the head there, have a color only.
const PARTS: {[part: string]: keyof PlayerCompositionParams["types"]} = {
    head: "head",
    ears: "ear",
    hat: "hat",
    torso: "torso",
    arms: "arm",
    bottom: "bottom",
};
const EYES = "eyes";

// What each shape is, in a few words, in the order of its part's builders (PlayerHead_0 first; see PlayerHead), which
// the panel numbers them in. A shape redesigned there is described anew here.
const SHAPE_NAMES: {[part: string]: string[]} = {
    head: ["box", "drum, its round face forward", "can, round all around", "rolling pin, round on top",
        "box banded around the middle", "cylinder banded around the middle"],
    ears: ["box", "disc", "plate with a knob", "speaker: a wide disc with a small one on it", "block with an antenna",
        "wing sweeping back"],
    hat: ["antenna", "brimmed hat", "flat cap", "propeller beanie", "crown", "crest"],
    torso: ["box", "cylinder", "broad block over a narrower one", "chest, narrow waist and hips",
        "broad cylinder over a narrower one", "bellows"],
    arms: ["straight block", "thick upper arm, thin forearm", "thin arm with a hand", "pipe with ball joints",
        "forearm held forward, with a fist", "pincer"],
    bottom: ["a big wheel on each side", "two wheels on each side", "three small wheels on each side",
        "one wheel in a fork, like a unicycle", "two wheels in a frame, like a bicycle",
        "three wheels in a row under a deck"],
};

const PART_PALETTE = "Player";
const EYE_PALETTE = "PlayerEye";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

// How a character looks, as people see it, and an agent's own changed as a person changes theirs in the customize
// panel: part by part, through the same metadata (see CustomizePlayerPanel).
const AgentAppearanceUtil =
{
    // How many shapes each part can take.
    getShapeCounts: (): {[part: string]: number} =>
    {
        return Object.fromEntries(Object.entries(PARTS).map(([part, key]) =>
            [part, PlayerCompositionConstants.numTypes[key]]));
    },
    // The agent's own look and what it can take, or the look of someone in its room, by name.
    look: (ctx: AgentUserContext, person?: string): object =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        const me = AgentRoomUtil.getMyPlayer(ctx);
        if (room == undefined || me == undefined)
            return {error: "You aren't in a room."};
        if (person != undefined && person.trim().length > 0)
        {
            const character = findCharacter(room, person);
            return (character == undefined) ? {error: `Nobody named "${person}" is in this room.`}
                : {name: character.name, appearance: describe(character.obj)};
        }
        return {
            appearance: describe(me),
            shapes: SHAPE_NAMES,
            part_colors: getHexes(PART_PALETTE),
            eye_colors: getHexes(EYE_PALETTE),
            note: "Each part's shapes are numbered from 1, in the order listed. A color given is changed to the nearest "
                + "one its part can take. change_appearance changes yours.",
        };
    },
    // Only what the request names changes. Costs an edit, as a change in the panel does, unless nothing changes.
    change: async (ctx: AgentUserContext, request: AgentAppearance): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        const me = AgentRoomUtil.getMyPlayer(ctx);
        if (room == undefined || me == undefined)
            return {error: "You aren't in a room."};

        const params = readParams(me);
        const before = encode(params);
        for (const [part, change] of Object.entries(request))
        {
            if (change == undefined)
                continue;
            const key = PARTS[part];
            if (key == undefined && part != EYES)
                return {error: `There is no part "${part}": the parts are ${[...Object.keys(PARTS), EYES].join(", ")}.`};
            if (change.shape != undefined)
            {
                if (key == undefined)
                    return {error: "The eyes have a color, and no shape."};
                const numShapes = PlayerCompositionConstants.numTypes[key];
                if (!Number.isInteger(change.shape) || change.shape < 1 || change.shape > numShapes)
                    return {error: `${part}.shape is a number from 1 to ${numShapes}.`};
                params.types[key] = change.shape - 1;
            }
            if (change.color != undefined)
            {
                if (!ColorUtil.isHex(change.color))
                    return {error: `${part}.color is a color, given as "#rrggbb".`};
                const palette = (key == undefined) ? EYE_PALETTE : PART_PALETTE;
                params.colors[key ?? "eye"] = ColorUtil.paletteIndexToRGB(palette,
                    ColorUtil.rgbToPaletteIndex(palette, ColorUtil.hexToRGB(change.color)));
            }
        }

        const after = encode(params);
        if (after == before)
            return {appearance: describe(me)};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent, appearance: describe(me)};
        await AgentSignalUtil.send(ctx, "setObjectMetadataSignal", new SetObjectMetadataSignal(room.id, me.objectId,
            ObjectMetadataKeyEnumMap.InstancedMeshComposition, after));

        const now = AgentRoomUtil.getMyPlayer(ctx) ?? me;
        return (now.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str == after)
            ? {appearance: describe(now), note: "Everyone sees it, and it stays yours on later visits."}
            : {error: "Your appearance couldn't be changed. Try again later.", appearance: describe(now)};
    },
}

// The look browsers draw a character in (see ObjectCompositionUtil): what it stores, or else its default.
function readParams(obj: AddObjectSignal): PlayerCompositionParams
{
    const params = {} as PlayerCompositionParams;
    ObjectCompositionUtil.decode(obj, params, []);
    return params;
}

function encode(params: PlayerCompositionParams): string
{
    const composer = PlayerObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;
    return CompositionMetadataUtil.encode(composer.codecType, composer.codecVersion, params);
}

function describe(obj: AddObjectSignal): AgentAppearance
{
    const params = readParams(obj);
    const appearance: AgentAppearance = {};
    for (const [part, key] of Object.entries(PARTS))
    {
        appearance[part] = {shape: params.types[key] + 1, shape_name: SHAPE_NAMES[part][params.types[key]],
            color: ColorUtil.rgbToHex(params.colors[key])};
        if (part == "head")
            appearance[EYES] = {color: ColorUtil.rgbToHex(params.colors.eye)};
    }
    return appearance;
}

// Someone in the room by name, as look lists people: a player (but a ghost; see AdminPrefsUtil), else a guide.
function findCharacter(room: Room, name: string): {name: string, obj: AddObjectSignal} | undefined
{
    const wanted = name.trim().toLowerCase();
    const player = Object.values(room.objectById).find(obj => obj.objectTypeIndex == playerTypeIndex
        && !AdminPrefsUtil.isGhost(obj) && obj.sourceUserName.toLowerCase() == wanted);
    if (player != undefined)
        return {name: player.sourceUserName, obj: player};
    const guide = HelperAgentUtil.getHelpers(room.id).find(helper => helper.name.toLowerCase() == wanted);
    const npc = (guide != undefined) ? room.objectById[guide.objectId] : undefined;
    return (guide != undefined && npc != undefined) ? {name: guide.name, obj: npc} : undefined;
}

function getHexes(palette: string): string[]
{
    return [...Array(ColorUtil.getPaletteSize(palette)).keys()]
        .map(index => ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(palette, index)));
}

export default AgentAppearanceUtil;
