import { FieldValue } from "firebase-admin/firestore";

export type DBColumnType = string | number | Buffer | undefined | FieldValue;