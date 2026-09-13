import * as admin from "firebase-admin";

// Row identity rule: "id" is the document key, never a stored field. Nothing writes "id" into a
// document, and every read stamps it onto the row. Both halves are required and live here so every
// runner (and migration) sees the same row shape.
const DBRowIdentityUtil =
{
    // A row as it should be stored: the same contents, minus the identity the document already has.
    forStorage: (docData: admin.firestore.DocumentData): admin.firestore.DocumentData =>
    {
        const { id, ...rest } = docData;
        return rest;
    },

    // Attaches the document ID, overwriting any legacy stored "id".
    fromDocument: (docData: admin.firestore.DocumentData, docID: string): admin.firestore.DocumentData =>
    {
        docData.id = docID;
        return docData;
    },
}

export default DBRowIdentityUtil;
