import PetIdentity from "./petIdentity";
import PetNeeds from "./petNeeds";

// One of the pets a user owns, as their player's Pets metadata keeps it (see PetRecordUtil): the id its object takes
// in whichever room it follows them into, who it is, and how it was when last told.
export default interface PetRecord
{
    petId: string;
    identity: PetIdentity;
    needs: PetNeeds;
}
