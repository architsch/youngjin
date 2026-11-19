import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import FieldDomainUtil from "./fieldDomainUtil";

// Comments open with the entry's own index ("[Index 5] 'Canvas': gilt, dark ochre inside."), kept in step
// here whenever entries move.
const INDEX_TAG_PATTERN = /^\[Index \d+\]/;
const LABEL_PATTERN = /^\[Index \d+\]\s*('[^']*')?\s*:?\s*/;

const NEW_ENTRY_GEOMETRY_ID = "Square";
const NEW_ENTRY_MATERIAL_ID = "InstancedColor";

const EntryUtil =
{
    // Only the entries whose tag changed are replaced.
    renumberIndexTags: (compositions: PreEncodingSourceEntry[]): PreEncodingSourceEntry[] =>
    {
        return compositions.map((entry, compositionIndex) => {
            if (entry.comment == undefined || !INDEX_TAG_PATTERN.test(entry.comment))
                return entry;
            const comment = entry.comment.replace(INDEX_TAG_PATTERN, `[Index ${compositionIndex}]`);
            return comment == entry.comment ? entry : {...entry, comment};
        });
    },

    // The comment's first sentence, without its index tag and type name.
    getCaption: (entry: PreEncodingSourceEntry): string =>
    {
        const text = (entry.comment ?? "").replace(LABEL_PATTERN, "").trim();
        const sentenceEnd = text.search(/\.(\s|$)/);
        return sentenceEnd < 0 ? text : text.slice(0, sentenceEnd + 1);
    },

    // A copy to be appended at compositionIndex, captioned as the original is.
    duplicate: (entry: PreEncodingSourceEntry, compositionIndex: number): PreEncodingSourceEntry =>
    {
        const comment = `[Index ${compositionIndex}] '${entry.objectType}': ${EntryUtil.getCaption(entry)}`.trim();
        return {...structuredClone(entry), comment};
    },

    // A type's first entry, when it has none to copy: one plain spelled-out part.
    create: (objectType: string, compositionIndex: number): PreEncodingSourceEntry =>
    {
        return {
            comment: `[Index ${compositionIndex}] '${objectType}':`,
            objectType,
            codecType: "Default",
            parts: [FieldDomainUtil.getDefaultPart(NEW_ENTRY_MATERIAL_ID, NEW_ENTRY_GEOMETRY_ID)],
        };
    },
}

export default EntryUtil;
