import RecipeSelection from "./recipeSelection";

// A handle of a selection's outline: a side or corner to resize it by (named by compass point, in its own turned
// axes), or the knob above it to turn it by.
export type SelectionHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "turn";

// Each resize handle's place on the outline, as signs of the selection's own axes (y down).
const HANDLE_SIGNS: {[handle: string]: [number, number]} = {
    n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1],
};
// A selection resized by hand keeps at least this, in the sample's pixels, across and down.
const MIN_SIDE = 2;
// Turns by the knob go in steps of these, in degrees: Shift's, and otherwise the angle slider's own.
const TURN_SNAP = 15;
const FREE_TURN_STEP = 0.5;

// A selection's shape in the sample's pixels (see RecipeSelection): its middle, half its size along its own axes,
// and its turn in radians, clockwise.
type SelectionFrame = {cx: number, cy: number, halfWidth: number, halfHeight: number, angle: number};

// Where a selection lies in a sample of the given size, in that sample's pixels, and how it is reshaped by hand.
// The turn is taken in pixels, so it holds whatever the sample's shape.
const SelectionGeometryUtil =
{
    getFrame: (selection: RecipeSelection, width: number, height: number): SelectionFrame =>
    {
        const [x, y, w, h] = selection.rect;
        return {cx: (x + w / 2) * width, cy: (y + h / 2) * height, halfWidth: Math.max(1e-6, w * width / 2),
            halfHeight: Math.max(1e-6, h * height / 2), angle: (selection.angle ?? 0) * Math.PI / 180};
    },

    // Whether a point (in pixels) lies inside: within the rectangle, less its rounded corners, or the ellipse.
    getTest: (selection: RecipeSelection, width: number, height: number): (x: number, y: number) => boolean =>
    {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        const {halfWidth, halfHeight} = frame;
        if (selection.shape == "ellipse")
        {
            return (x, y) => {
                const [u, v] = toLocal(frame, x, y);
                return (u / halfWidth) ** 2 + (v / halfHeight) ** 2 <= 1;
            };
        }
        const r = clamp(selection.radius, 0, 0.5) * 2 * Math.min(halfWidth, halfHeight);
        return (x, y) => {
            const [u, v] = toLocal(frame, x, y);
            if (Math.abs(u) > halfWidth || Math.abs(v) > halfHeight)
                return false;
            const du = Math.max(Math.abs(u) - (halfWidth - r), 0);
            const dv = Math.max(Math.abs(v) - (halfHeight - r), 0);
            return du * du + dv * dv <= r * r;
        };
    },

    // The outline as an SVG path, in pixels.
    getPath: (selection: RecipeSelection, width: number, height: number): string =>
    {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        const {halfWidth: hw, halfHeight: hh} = frame;
        const at = (u: number, v: number) => toSample(frame, u, v).map(value => value.toFixed(2)).join(" ");
        const degrees = frame.angle * 180 / Math.PI;
        if (selection.shape == "ellipse")
            return `M${at(-hw, 0)}A${hw} ${hh} ${degrees} 1 0 ${at(hw, 0)}A${hw} ${hh} ${degrees} 1 0 ${at(-hw, 0)}Z`;
        const r = clamp(selection.radius, 0, 0.5) * 2 * Math.min(hw, hh);
        const arc = (u: number, v: number) => (r > 0) ? `A${r} ${r} 0 0 1 ${at(u, v)}` : `L${at(u, v)}`;
        return `M${at(-hw + r, -hh)}L${at(hw - r, -hh)}${arc(hw, -hh + r)}L${at(hw, hh - r)}${arc(hw - r, hh)}`
            + `L${at(-hw + r, hh)}${arc(-hw, hh - r)}L${at(-hw, -hh + r)}${arc(-hw + r, -hh)}Z`;
    },

    // Where each handle is, in pixels. The turning knob stands turnOffset pixels above the top side, or as far below
    // it where above would be off the sample (and so out of the pointer's reach); either way it points away from the
    // middle along the selection's up.
    getHandles: (selection: RecipeSelection, width: number, height: number,
        turnOffset: number): {handle: SelectionHandle, point: [number, number]}[] =>
    {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        const handles: {handle: SelectionHandle, point: [number, number]}[] = Object.entries(HANDLE_SIGNS).map(
            ([handle, [su, sv]]) => ({handle: handle as SelectionHandle,
                point: toSample(frame, su * frame.halfWidth, sv * frame.halfHeight)}));
        const outside = toSample(frame, 0, -frame.halfHeight - turnOffset);
        const onSample = outside[0] >= 0 && outside[0] <= width && outside[1] >= 0 && outside[1] <= height;
        handles.push({handle: "turn", point: onSample ? outside
            : toSample(frame, 0, -Math.max(frame.halfHeight - turnOffset, frame.halfHeight / 2))});
        return handles;
    },

    // The screen direction a resize handle faces once turned, in degrees clockwise from east, for its cursor.
    getHandleDirection: (selection: RecipeSelection, handle: Exclude<SelectionHandle, "turn">): number =>
    {
        const [su, sv] = HANDLE_SIGNS[handle];
        return Math.atan2(sv, su) * 180 / Math.PI + (selection.angle ?? 0);
    },

    // Resized by dragging a handle to a point (in pixels): the side or corner across from it stays put. With
    // keepShape, a corner keeps the selection's proportions.
    resize: (selection: RecipeSelection, handle: Exclude<SelectionHandle, "turn">, point: [number, number],
        width: number, height: number, keepShape: boolean): RecipeSelection =>
    {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        const [su, sv] = HANDLE_SIGNS[handle];
        const [pu, pv] = toLocal(frame, point[0], point[1]);
        let halfWidth = frame.halfWidth, halfHeight = frame.halfHeight;
        if (su != 0)
            halfWidth = Math.max(MIN_SIDE / 2, su * (pu + su * frame.halfWidth) / 2);
        if (sv != 0)
            halfHeight = Math.max(MIN_SIDE / 2, sv * (pv + sv * frame.halfHeight) / 2);
        if (keepShape && su != 0 && sv != 0)
        {
            const scale = Math.max(halfWidth / frame.halfWidth, halfHeight / frame.halfHeight);
            halfWidth = frame.halfWidth * scale;
            halfHeight = frame.halfHeight * scale;
        }
        // The fixed side's middle, then out from it by the new half size.
        const [cx, cy] = toSample(frame, su * (halfWidth - frame.halfWidth), sv * (halfHeight - frame.halfHeight));
        return {...selection, rect: [(cx - halfWidth) / width, (cy - halfHeight) / height,
            2 * halfWidth / width, 2 * halfHeight / height]};
    },

    // Turned so the knob points at a point (in pixels); with snap, in steps.
    turnToward: (selection: RecipeSelection, point: [number, number], width: number, height: number,
        snap: boolean): RecipeSelection =>
    {
        const frame = SelectionGeometryUtil.getFrame(selection, width, height);
        const degrees = Math.atan2(point[1] - frame.cy, point[0] - frame.cx) * 180 / Math.PI + 90;
        const step = snap ? TURN_SNAP : FREE_TURN_STEP;
        const angle = normalizeDegrees(Math.round(degrees / step) * step);
        return {...selection, angle: (angle == 0) ? undefined : angle};
    },

    // Moved by the pointer's travel (fractions of the sample), keeping its middle within the sample.
    move: (selection: RecipeSelection, du: number, dv: number): RecipeSelection =>
    {
        const [x, y, w, h] = selection.rect;
        const cx = clamp(x + w / 2 + du, 0, 1), cy = clamp(y + h / 2 + dv, 0, 1);
        return {...selection, rect: [cx - w / 2, cy - h / 2, w, h]};
    },
}

// A point in the sample's pixels, in the selection's own axes from its middle.
function toLocal(frame: SelectionFrame, x: number, y: number): [number, number]
{
    const dx = x - frame.cx, dy = y - frame.cy;
    const cos = Math.cos(frame.angle), sin = Math.sin(frame.angle);
    return [dx * cos + dy * sin, -dx * sin + dy * cos];
}

function toSample(frame: SelectionFrame, u: number, v: number): [number, number]
{
    const cos = Math.cos(frame.angle), sin = Math.sin(frame.angle);
    return [frame.cx + u * cos - v * sin, frame.cy + u * sin + v * cos];
}

// Into (-180, 180].
function normalizeDegrees(degrees: number): number
{
    const wrapped = ((degrees % 360) + 360) % 360;
    return (wrapped > 180) ? wrapped - 360 : wrapped;
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default SelectionGeometryUtil;
