import { PetEditKind } from "./petEditKind";
import PetLine from "./petLine";

// What pets chat in, beyond their reactions (see PetLineMap): the server's own (see PET_LINES), and a browser's once it
// has fetched them (see PetLineLoadUtil), so that the client's bundle carries none of it. A word to someone takes
// their name where it says PET_NAME_SLOT.
type PetLineData = {
    // What two pets say to each other, a chat each, its lines said in turn, the one who began it first. A chat is told
    // to the room by its place, among these and then the readingTalks, so a chat is only ever added at the end of its
    // list.
    talks: PetLine[][],
    // A chat about one of the maker's writings, ending with a link to it.
    readingTalks: PetLine[][],
    // What a pet says of a thing placed near it, by the thing's type; and, of some, now and then a word about a writing.
    objectRemarks: {[objectType: string]: PetLine[]},
    readingObjectRemarks: {[objectType: string]: PetLine[]},
    // What it says of what someone has just built or changed near it.
    editRemarks: {[kind in PetEditKind]: PetLine[]},
    // What it says to someone near it doing nothing in particular: its owner, anyone else, and now and then, nameless,
    // a word about a writing.
    ownerRemarks: PetLine[],
    strangerRemarks: PetLine[],
    readingPersonRemarks: PetLine[],
};

export default PetLineData;
