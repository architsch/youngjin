import { DBColumnType } from "./dbColumnType";
import { DBQueryCondOperator } from "./dbQueryCondOperator";

export interface DBQueryCond
{
    columnName: string;
    operator: DBQueryCondOperator;
    value: DBColumnType;
}