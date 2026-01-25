// Array Index = "version number to migrate from"
// (Example: The function at index N migrates the given row from version N to version N+1)
export type DBVersionMigration = ((row: any) => any)[];