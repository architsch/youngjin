import * as admin from "firebase-admin";

// Where a row's identity lives, and the single place that decides it.
//
// A row carries an "id" so callers can tell which document it came from, but that identity belongs
// to the document, not to its contents: Firestore already stores it as the document's key, and
// every lookup in this codebase resolves "id" to that key rather than to a field (see DBQuery's
// handling of `where("id", "==", ...)`). A copy kept inside the document is therefore never read —
// and, being never read, is free to drift out of agreement with the key it duplicates.
//
// So the rule is symmetric, and both halves of it live here:
//   - Nothing writes "id" into a document.
//   - Everything stamps it onto a row on the way out of one.
//
// Both halves matter equally. Applying the first without the second would hand callers rows with
// no identity at all; applying the second in one runner but not another — which is how this drifted
// once already — means a migration function sees a differently shaped row depending on which query
// happened to trigger it.
const DBRowIdentityUtil =
{
    // A row as it should be stored: the same contents, minus the identity the document already has.
    forStorage: (docData: admin.firestore.DocumentData): admin.firestore.DocumentData =>
    {
        const { id, ...rest } = docData;
        return rest;
    },

    // A row as callers expect to receive it, with the document's own ID attached. Any "id" the
    // document still carries from before this rule was enforced is overwritten rather than trusted.
    fromDocument: (docData: admin.firestore.DocumentData, docID: string): admin.firestore.DocumentData =>
    {
        docData.id = docID;
        return docData;
    },
}

export default DBRowIdentityUtil;
