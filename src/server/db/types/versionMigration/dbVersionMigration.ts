// Index N migrates a row from version N to N+1.
export type DBVersionMigration = ((row: any) => Promise<any>)[];