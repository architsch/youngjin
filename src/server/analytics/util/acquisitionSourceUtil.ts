import { ACQUISITION_SOURCE_DIRECT, ACQUISITION_SOURCE_MAX_LENGTH } from "../../system/serverConstants";

// Where a visitor came from, taken from the "ref" query parameter on the address they arrived at
// (e.g. https://app.thingspool.net/?ref=reddit-webgames).
//
// The value is written by whoever posted the link, which means it is untrusted input that ends up
// forming part of a Firestore document ID. So it is not merely trimmed but rebuilt: anything
// outside the permitted alphabet is dropped rather than escaped, and what survives is capped. A
// value that has nothing left after that is treated as no value at all.
//
// The number of distinct sources is bounded by the number of accounts that can be created, which
// GuestCreationLimitUtil already limits per IP and User-Agent. That is what stops a stream of
// invented ref tags from turning into an unbounded collection of counter documents.
const AcquisitionSourceUtil =
{
    // A visitor arriving with no usable tag is not "unknown" — they are direct traffic, which is a
    // cohort like any other and is worth comparing the tagged ones against.
    normalize: (rawRef: unknown): string =>
    {
        if (typeof rawRef != "string")
            return ACQUISITION_SOURCE_DIRECT;

        const cleaned = rawRef
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, ACQUISITION_SOURCE_MAX_LENGTH);

        return cleaned.length > 0 ? cleaned : ACQUISITION_SOURCE_DIRECT;
    },

    // Express gives a repeated query parameter as an array and a bracketed one as an object, so the
    // raw value is not necessarily the string it looks like in the address bar. Only a plain string
    // is honoured; anything else falls back to direct rather than being coerced into a shape that
    // would then be sanitised into nonsense.
    fromQuery: (query: Record<string, unknown> | undefined): string =>
    {
        return AcquisitionSourceUtil.normalize(query ? query["ref"] : undefined);
    },

    // The cohort a user belongs to: the UTC day they arrived. Cohorts are keyed by arrival rather
    // than by the day a milestone happened, because the question this data exists to answer is what
    // became of the people a given push brought in — which cannot be read off counts scattered
    // across whichever days they happened to come back on.
    cohortDay: (timestampMs: number): string =>
    {
        return new Date(timestampMs).toISOString().slice(0, 10);
    },
}

export default AcquisitionSourceUtil;
