import AdminPrefs from "../types/adminPrefs";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import StringUtil from "../../math/util/stringUtil";

// Character positions in the stored string, one base-94 character per field (see StringUtil). Never
// reorder; append only (missing characters default).
const GHOST_MODE_CHAR_INDEX = 0;

// Encodes and decodes AdminPrefs. Decoding is total, so any string (including "") is a valid value;
// who may set them is ObjectMetadataEntryMap's rule.
const AdminPrefsUtil =
{
    decode: (prefs: string): AdminPrefs =>
    {
        return {
            ghostMode: StringUtil.convertVisibleASCIIToRawNumber(prefs, GHOST_MODE_CHAR_INDEX, 0) != 0,
        };
    },
    encode: (prefs: AdminPrefs): string =>
    {
        const chars: string[] = [];
        chars[GHOST_MODE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(prefs.ghostMode ? 1 : 0);
        return chars.join("");
    },
    canonicalize: (prefs: string): string =>
    {
        return AdminPrefsUtil.encode(AdminPrefsUtil.decode(prefs));
    },
    getObjectPrefs: (obj: AddObjectSignal): AdminPrefs =>
    {
        return AdminPrefsUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.AdminPrefs]?.str ?? "");
    },
}

export default AdminPrefsUtil;
