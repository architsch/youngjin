import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import PreEncodingSourceUtil from "../../../../../src/shared/graphics/mesh/composition/util/preEncodingSourceUtil";
import EntryEncoding from "../types/entryEncoding";

const ERROR_PREFIX = "Composition pre-encoding failed :: ";

// Entries are replaced, never mutated, so an untouched one is not encoded again.
const cache = new WeakMap<PreEncodingSourceEntry, {compositionIndex: number, encoding: EntryEncoding}>();

// Runs an entry through the build's own encoder (see PreEncodingSourceUtil).
const EntryEncodingUtil =
{
    encode: (entry: PreEncodingSourceEntry, compositionIndex: number): EntryEncoding =>
    {
        const cached = cache.get(entry);
        if (cached != undefined && cached.compositionIndex == compositionIndex)
            return cached.encoding;

        // Some codec problems are only logged by the build (e.g. an offset outside the range it is stored in).
        const warnings: string[] = [];
        const {error, warn} = console;
        console.error = console.warn = (...args: any[]) => warnings.push(args.map(String).join(" "));
        let encoding: EntryEncoding;
        try
        {
            encoding = {encoded: PreEncodingSourceUtil.encodeEntry(entry, compositionIndex), warnings};
        }
        catch (err)
        {
            encoding = {error: tidyMessage(err instanceof Error ? err.message : String(err)), warnings};
        }
        finally
        {
            console.error = error;
            console.warn = warn;
        }
        cache.set(entry, {compositionIndex, encoding});
        return encoding;
    },
}

export default EntryEncodingUtil;

// The entry is already on screen, so only the part is worth naming.
function tidyMessage(message: string): string
{
    return message
        .replace(ERROR_PREFIX, "")
        .replace(/ \(compositionIndex = \d+\)$/, "")
        .replace(/\(compositionIndex = \d+, partIndex = (\d+)\)$/, (_, partIndex) => `(part ${Number(partIndex) + 1})`);
}
