import App from "../../app";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";

// The single source of truth for a player character's body — shared by the renderer (PlayerGameObject)
// and the customization menu (CustomizePlayerForm). Keeping it in one place is what guarantees the two
// stay in lockstep: an appearance is encoded *positionally* (entry i describes parts[i]), so the part
// list/order here is the contract both sides must agree on. The appearance codec itself lives here too
// (encodeAppearance/resolveAppearance), since it depends on that same part order + per-part defaults.
//
// A player is a "floating-limb creature": several detached rigid parts hovering in a fixed formation.
// Each part has its OWN smooth geometry (so parts differ in shape, not just size), but all parts share
// ONE texture atlas: every part's InstancedMesh is loaded with the same material params, so the texture
// is fetched once and reused. Parts that share a geometry (the two hands) also share one InstancedMesh
// and instance pool. Per part the user may pick an atlas texture cell + a color tint; geometry/offset/
// scale are the fixed (non-customizable) layout.
//
// The atlas asset must exist at `${assets_url}/<imagePathSuffix>`. Until it does, players render bodiless
// (logged, non-fatal). The geometries, offsets/scales, default cells/colors, and per-part textureChoices
// below are placeholders to tune against the real atlas once it is authored.

// Lazily built so it can read the runtime assets URL; cached because the atlas is shared by every player.
let materialParams: TexturePackMaterialParams | undefined;

const PlayerBodyConfig =
{
    atlas: {
        imagePathSuffix: "player/player_parts_pack.png",
        width: 1024, height: 1024,
        cellWidth: 128, cellHeight: 128,
    },

    // Order is the encoding contract — do not reorder without bumping how appearances are interpreted.
    // geometryId names an entry in GeometryConstructorMap; parts may reuse a geometry (the two hands do).
    parts: [
        {
            name: "Torso", geometryId: "Capsule", // central, elongated rounded body
            offsetX: 0, offsetY: 1.4, offsetZ: 0,
            scaleX: 0.6, scaleY: 0.85, scaleZ: 0.45,
            defaultTextureIndex: 8, defaultColorHex: 0x3399cc,
            textureChoices: [8, 9, 10, 11, 12, 13, 14, 15],
        },
        {
            name: "Head", geometryId: "Sphere", // above the torso, separated by a gap
            offsetX: 0, offsetY: 2.2, offsetZ: 0,
            scaleX: 0.6, scaleY: 0.6, scaleZ: 0.6,
            defaultTextureIndex: 0, defaultColorHex: 0xcc3344,
            textureChoices: [0, 1, 2, 3, 4, 5, 6, 7],
        },
        {
            name: "Left hand", geometryId: "Icosphere", // small gem-like orb floating off to the side
            offsetX: -0.7, offsetY: 1.4, offsetZ: 0,
            scaleX: 0.28, scaleY: 0.28, scaleZ: 0.28,
            defaultTextureIndex: 16, defaultColorHex: 0xffcc00,
            textureChoices: [16, 17, 18, 19, 20, 21, 22, 23],
        },
        {
            name: "Right hand", geometryId: "Icosphere", // mirror of the left (shares its geometry)
            offsetX: 0.7, offsetY: 1.4, offsetZ: 0,
            scaleX: 0.28, scaleY: 0.28, scaleZ: 0.28,
            defaultTextureIndex: 16, defaultColorHex: 0xffcc00,
            textureChoices: [16, 17, 18, 19, 20, 21, 22, 23],
        },
        {
            name: "Tail", geometryId: "Cone", // tapered, below the torso
            offsetX: 0, offsetY: 0.5, offsetZ: 0,
            scaleX: 0.34, scaleY: 0.34, scaleZ: 0.34,
            defaultTextureIndex: 24, defaultColorHex: 0x66cc66,
            textureChoices: [24, 25, 26, 27, 28, 29, 30, 31],
        },
    ],

    // The shared atlas material params, built once from the runtime assets URL. Both the renderer (to
    // load every part's InstancedMesh) and the UI (to draw atlas-cell thumbnails) read its path + cell
    // dimensions. Passing this same object to each part's load is what makes them share one texture.
    getMaterialParams(): TexturePackMaterialParams
    {
        if (materialParams == undefined)
            materialParams = new TexturePackMaterialParams(
                `${App.getEnv().assets_url}/${this.atlas.imagePathSuffix}`,
                this.atlas.width, this.atlas.height,
                this.atlas.cellWidth, this.atlas.cellHeight,
                "staticImageFromPath");
        return materialParams;
    },

    // The distinct geometries the body uses and how many parts of one player use each. The renderer loads
    // one shared InstancedMesh (+ instance pool) per distinct geometry, sized for players × partsPerPlayer.
    distinctGeometries(): { geometryId: string; partsPerPlayer: number }[]
    {
        const countByGeometry: { [geometryId: string]: number } = {};
        for (const part of this.parts)
            countByGeometry[part.geometryId] = (countByGeometry[part.geometryId] ?? 0) + 1;
        return Object.keys(countByGeometry)
            .map(geometryId => ({ geometryId, partsPerPlayer: countByGeometry[geometryId] }));
    },

    // Serializes fully-specified per-part values into the compact stored form: parts joined by ",", each
    // "<textureIndex>:<colorHex base16>". Inverse of resolveAppearance.
    encodeAppearance(parts: { textureIndex: number; colorHex: number }[]): string
    {
        return parts
            .map(part => `${part.textureIndex}:${(part.colorHex & 0xFFFFFF).toString(16)}`)
            .join(",");
    },

    // Decodes a stored appearance string into fully-specified per-part values, substituting each part's
    // default for any field that is missing or malformed. Positional (token i ↔ parts[i]), so a single
    // bad/absent token falls back to that part's default without shifting the others. Tolerates undefined
    // (no appearance saved yet → all defaults). This is the one place decode + default-resolution lives.
    resolveAppearance(encoded: string | undefined): { textureIndex: number; colorHex: number }[]
    {
        const tokens = encoded ? encoded.split(",") : [];
        return this.parts.map((part, i) =>
        {
            const [textureIndexStr, colorHexStr] = (tokens[i] ?? "").split(":");
            const textureIndex = parseInt(textureIndexStr, 10); // NaN if absent/unparseable
            const colorHex = parseInt(colorHexStr, 16);          // NaN if absent/unparseable
            return {
                textureIndex: (Number.isFinite(textureIndex) && textureIndex >= 0)
                    ? textureIndex : part.defaultTextureIndex,
                colorHex: Number.isFinite(colorHex) ? (colorHex & 0xFFFFFF) : part.defaultColorHex,
            };
        });
    },
};

export default PlayerBodyConfig;
