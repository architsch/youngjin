import { DBRow } from "./row/dbRow";

export default interface DBQueryResponse<T extends DBRow>
{
    success: boolean;
    data: T[];
}