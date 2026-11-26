import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import PetNeeds from "../types/petNeeds";
import PetRecord from "../types/petRecord";
import PetIdentityUtil from "./petIdentityUtil";
import PetNeedsUtil, { PET_NEEDS_LENGTH } from "./petNeedsUtil";

// The most pets a user owns at once (an admin's stay with the room instead; see ServerPetObjectTypeConfig).
export const MAX_PETS_PER_USER = 16;
// A pet's id is its object's in every room it follows its owner into: as long as an object's random one (see
// ObjectIdUtil), of letters and digits alone.
export const PET_ID_LENGTH = 8;
const PET_ID_PATTERN = /^[A-Za-z0-9]{8}$/;
// Records are told apart by a line break, which no name holds (see PetIdentityUtil.sanitizeName).
const RECORD_SEPARATOR = "\n";
// What a report begins with, which no record does, a pet's id being letters and digits.
const REPORT_MARK = "~";
const REPORT_ENTRY_LENGTH = PET_ID_LENGTH + PET_NEEDS_LENGTH;

// The pets a user owns, as their player's Pets metadata holds them, and so their row's playerMetadata between visits
// (see ServerUserManager): each by its id, how it was when last told, and who it is. Which pets it lists is the
// server's alone to change (see PetServerUtil): a user's browser, which plays their pets, sets only how each of them
// is, by a report (see merge). Decoding is total, so any string is a value: by default no pets. Read as a player's type
// is made, so it imports nothing that leads back to the types (see PetOwnerUtil for what does).
const PetRecordUtil =
{
    decode: (value: string): PetRecord[] =>
    {
        if (PetRecordUtil.isReport(value))
            return [];
        const records: PetRecord[] = [];
        for (const entry of value.split(RECORD_SEPARATOR))
        {
            const petId = entry.slice(0, PET_ID_LENGTH);
            if (!PetRecordUtil.isPetId(petId) || records.length >= MAX_PETS_PER_USER
                || records.some(record => record.petId == petId))
            {
                continue;
            }
            records.push({petId, needs: PetNeedsUtil.decode(entry.slice(PET_ID_LENGTH, REPORT_ENTRY_LENGTH)),
                identity: PetIdentityUtil.decode(entry.slice(REPORT_ENTRY_LENGTH))});
        }
        return records;
    },
    encode: (records: PetRecord[]): string =>
    {
        return records.slice(0, MAX_PETS_PER_USER).map(record => record.petId + PetNeedsUtil.encode(record.needs)
            + PetIdentityUtil.encode(record.identity)).join(RECORD_SEPARATOR);
    },
    isPetId: (objectId: string): boolean =>
    {
        return PET_ID_PATTERN.test(objectId);
    },
    // How some of a user's pets now are, as their browser tells it: the one form of the key's value a user may set.
    encodeReport: (needsByPetId: {[petId: string]: PetNeeds}): string =>
    {
        return REPORT_MARK + Object.keys(needsByPetId).filter(PetRecordUtil.isPetId)
            .map(petId => petId + PetNeedsUtil.encode(needsByPetId[petId])).join("");
    },
    isReport: (value: string): boolean =>
    {
        return value.startsWith(REPORT_MARK);
    },
    // What a value set under the key leaves stored, given what the player holds there (nothing, as it arrives). A
    // report changes how the pets it names are, where the player has them, and nothing else: so a user, who may set
    // nothing but a report (see PlayerObjectTypeConfig), neither adds a pet nor removes one. Anything else is the
    // whole record, as the server keeps and tells it.
    merge: (rawValue: string, currentValue?: string): string =>
    {
        if (!PetRecordUtil.isReport(rawValue))
            return PetRecordUtil.encode(PetRecordUtil.decode(rawValue));
        const records = PetRecordUtil.decode(currentValue ?? "");
        for (let i = REPORT_MARK.length; i + REPORT_ENTRY_LENGTH <= rawValue.length; i += REPORT_ENTRY_LENGTH)
        {
            const record = records.find(owned => owned.petId == rawValue.slice(i, i + PET_ID_LENGTH));
            if (record != undefined)
                record.needs = PetNeedsUtil.decode(rawValue.slice(i + PET_ID_LENGTH, i + REPORT_ENTRY_LENGTH));
        }
        return PetRecordUtil.encode(records);
    },
    getPlayerRecords: (player: AddObjectSignal | undefined): PetRecord[] =>
    {
        return PetRecordUtil.decode(player?.metadata[ObjectMetadataKeyEnumMap.Pets]?.str ?? "");
    },
}

export default PetRecordUtil;
