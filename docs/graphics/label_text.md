# Label Text

Reference: @src/client/object/components/labelText.ts , @src/client/graphics/types/textureAtlasAllocator.ts , @src/client/object/util/labelTextLayoutUtil.ts , @src/client/graphics/util/fontMetricsUtil.ts , @src/shared/object/util/labelTextUtil.ts , @src/shared/object/types/objectTypeConfig/labelObjectTypeConfig.ts

`LabelText` draws an object's `Label` metadata onto a patch of the object in the scene (not an HTML overlay), so walls occlude it. A door carries one on its plate; a `Label` object is a sign on a wall: text on a plaque, or straight on the wall without a frame.

## Patch
- `labelText.localTransform` (a `Transform`) places the patch relative to the object's transform, and the object's scale multiplies it, so a resized object's patch grows with it.
- An object that frames its text narrows the drawn area with `LabelText.setContentSize`: a label passes the inside of its plaque's band (`FramedPanelCompositionConstants`) after every recomposition.
- Moves and resizes arrive through the object's transform notification (`GameObject.notifyTransformChanged`); nothing polls.

## Atlas
- Every label in a room shares one single-channel atlas and one instanced mesh (one draw call); each label's ink is its instance color.
- A label holds a region of whole cells sized to its patch. A cell covers a fixed patch of world space, so text has the same density at any label size, and a font size means the same on every label.
- `TextureAtlasAllocator` hands regions out with contact-point packing: each goes where its border touches the most taken cells and atlas edges, so regions settle into flush blocks instead of leaving slivers.
- Only a resize that changes a label's size in cells reallocates. Text, font, ink and frame edits redraw in place.
- When fragmentation still leaves no room, every label is packed again from scratch, largest first, and redrawn. The room caps of the categories that carry labels (`ObjectCategoryConfigMap`) are chosen so that this always succeeds, even with every label at its largest (tested).
- The atlas lives only on the GPU, so every label redraws after a graphics context restore.

## Lettering
- **Auto Size** (the default): the largest size at which the whole text fits, words kept whole and spread evenly over the lines.
- **Fixed size**: one of a short list of sizes in atlas pixels, stored by its position in the list (so changing the list takes an `ObjectGroup` migration). A word wider than a line breaks between characters, and lines past the bottom are cut off (the text is top-aligned once it overflows).
- A line break in the text starts a new line; within a line, wrapping is automatic.
- **One font, identical everywhere**: every label is plain text in Tinos (Times New Roman's widths), cut down to Latin and inlined into the client bundle (`vendor.misc.js`), not left to each system's fonts. Widths come from the font file's own tables (`FontMetricsUtil`), never from the browser, and each character is drawn at those positions, so a label wraps and sizes identically on every browser. The font has no kerning or ligatures, so it can't be spaced any other way. No markup is read.
- A character the font lacks (emoji, Hangul, anything outside Latin) is drawn as U+FFFD, after composing accents. The stored text keeps it as typed.
- `LabelTextUtil` reads the text, ink and font from metadata. The font is one canonical stored string, round-tripped on write (`ObjectMetadataEntryMap`), so no value a client sends stores an undrawable font.
- `LabelTextLayoutUtil` does the line breaking apart from any canvas, so it can be tested.
- Label text is long, so the room encoding allowance (`EncodingUtil`) is sized for every category at its cap with every label at its longest (tested).

## Who may edit
- A door's label follows the door's rule, and `Label` objects follow the same one: the room's superuser (see [restricted_zone.md](../gameplay/restricted_zone.md)).
- A door's label, as read (whitespace collapsed), is also the name other doors look it up by (see [room_entrance.md](../geometry/room_entrance.md)).
