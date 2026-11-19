import ParticleEffectConfigUtil from "../../../../../src/client/graphics/particle/util/particleEffectConfigUtil";
import ParticleEffectSource from "../types/particleEffectSource";

// Writes the source the way the repository keeps it, so a save changes only the lines that were edited: the
// file, its effects and their layers spread out one member per line (known fields in ParticleEffectConfigUtil's
// order, anything else after them), and every value on one line.
const INDENT = "    ";
// Enough for any value typed or dragged, without arithmetic's float noise (0.30000000000000004).
const DECIMALS = 6;
const EFFECT_FIELDS: string[] = ParticleEffectConfigUtil.getEffectFields();
const LAYER_FIELDS: string[] = ParticleEffectConfigUtil.getLayerFields();

const SourceFormatUtil =
{
    format: (source: ParticleEffectSource): string =>
    {
        const record = source as unknown as {[key: string]: unknown};
        const members = getOrderedKeys(record, ["effects"]).map(key => `${INDENT}${JSON.stringify(key)}: ` +
            ((key == "effects" && isRecord(record[key])) ? formatEffects(record[key]) : formatInline(record[key])));
        return `{\n${members.join(",\n")}\n}\n`;
    },
}

function formatEffects(effects: {[effect: string]: unknown}): string
{
    const members = getOrderedKeys(effects, []).map(effect =>
        `${INDENT.repeat(2)}${JSON.stringify(effect)}: ${formatEffect(effects[effect])}`);
    return spread(members, 1, "{", "}");
}

function formatEffect(effect: unknown): string
{
    if (!isRecord(effect))
        return formatInline(effect);
    const members = getOrderedKeys(effect, EFFECT_FIELDS).map(key => `${INDENT.repeat(3)}${JSON.stringify(key)}: ` +
        ((key == "layers" && Array.isArray(effect[key])) ? formatLayers(effect[key]) : formatInline(effect[key])));
    return spread(members, 2, "{", "}");
}

function formatLayers(layers: unknown[]): string
{
    return spread(layers.map(layer => INDENT.repeat(4) + formatLayer(layer)), 3, "[", "]");
}

function formatLayer(layer: unknown): string
{
    if (!isRecord(layer))
        return formatInline(layer);
    const members = getOrderedKeys(layer, LAYER_FIELDS).map(key =>
        `${INDENT.repeat(5)}${JSON.stringify(key)}: ${formatInline(layer[key])}`);
    return spread(members, 4, "{", "}");
}

// Members one per line, closed at the depth the container opens on.
function spread(members: string[], depth: number, open: string, close: string): string
{
    return (members.length == 0) ? open + close : `${open}\n${members.join(",\n")}\n${INDENT.repeat(depth)}${close}`;
}

function formatInline(value: unknown): string
{
    if (Array.isArray(value))
        return `[${value.map(formatInline).join(", ")}]`;
    if (isRecord(value))
        return `{${getOrderedKeys(value, []).map(key => `${JSON.stringify(key)}: ${formatInline(value[key])}`).join(", ")}}`;
    if (typeof value == "number" && Number.isFinite(value))
        return JSON.stringify(Number(value.toFixed(DECIMALS)));
    return JSON.stringify(value) ?? "null";
}

// Known keys first, in their order, then the rest as they come. As JSON.stringify does, a member set to
// undefined is left out.
function getOrderedKeys(record: {[key: string]: unknown}, known: string[]): string[]
{
    const present = Object.keys(record).filter(key => record[key] !== undefined);
    return [...known.filter(key => present.includes(key)), ...present.filter(key => !known.includes(key))];
}

function isRecord(value: unknown): value is {[key: string]: unknown}
{
    return typeof value == "object" && value != null && !Array.isArray(value);
}

export default SourceFormatUtil;
