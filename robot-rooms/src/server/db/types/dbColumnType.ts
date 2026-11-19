import { FieldValue } from "firebase-admin/firestore";

export type DBColumnType =
    | string
    | number
    | Buffer
    | undefined
    | FieldValue
    | {[key: string]: string}
    | {[key: string]: number}
    | Array<{[key: string]: string}>;