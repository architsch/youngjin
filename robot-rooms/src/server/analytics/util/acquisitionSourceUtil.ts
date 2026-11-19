import { ACQUISITION_SOURCE_DIRECT, ACQUISITION_SOURCE_MAX_LENGTH } from "../../system/serverConstants";

// Traffic source from the "ref" query parameter. Untrusted and used in document IDs, so it's rebuilt
// from an allowed alphabet and capped; empty results mean no source. Distinct sources are bounded by
// GuestCreationLimitUtil's account caps.
const AcquisitionSourceUtil =
{
    // No usable tag means "direct", a real cohort.
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

    // Express may give arrays or objects for repeated/bracketed params; only plain strings count.
    fromQuery: (query: Record<string, unknown> | undefined): string =>
    {
        return AcquisitionSourceUtil.normalize(query ? query["ref"] : undefined);
    },

    // Cohort = UTC arrival day (not the milestone day), so outcomes credit the arrival cohort.
    cohortDay: (timestampMs: number): string =>
    {
        return new Date(timestampMs).toISOString().slice(0, 10);
    },
}

export default AcquisitionSourceUtil;
