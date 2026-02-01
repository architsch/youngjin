import * as admin from "firebase-admin";
import DBQueryResponse from "./dbQueryResponse";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import { DBRow } from "./row/dbRow";
import { DBQueryCondOperator } from "./dbQueryCondOperator";
import { DBQueryType } from "./dbQueryType";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import { DBColumnType } from "./dbColumnType";
import { DBQueryOrderBy } from "./dbQueryOrderBy";
import runQuerySelect from "../runners/runQuerySelect";
import runQueryInsert from "../runners/runQueryInsert";
import runQueryUpdate from "../runners/runQueryUpdate";
import runQueryDelete from "../runners/runQueryDelete";
import LogUtil from "../../../shared/system/util/logUtil";

export default class DBQuery<T extends DBRow>
{
    type: DBQueryType = "?";
    tableId: string = "";
    docId: string | undefined;
    columnValues: DBRow = {};
    condGroups: admin.firestore.Filter[][] = [[]];
    orderByCommand: DBQueryOrderBy | undefined;
    limitCommand: number | undefined;
    offsetCommand: number | undefined;

    select(): DBQuery<T>
    {
        if (this.type != "?")
            throw new Error(`DB query syntax error: Query type is already determined (${this.type})`);
        this.type = "select";
        return this;
    }
    insertInto(tableId: string): DBQuery<T>
    {
        if (this.type != "?")
            throw new Error(`DB query syntax error: Query type is already determined (${this.type})`);
        this.type = "insert";
        this.tableId = tableId;
        return this;
    }
    delete(): DBQuery<T>
    {
        if (this.type != "?")
            throw new Error(`DB query syntax error: Query type is already determined (${this.type})`);
        this.type = "delete";
        return this;
    }
    update(tableId: string): DBQuery<T>
    {
        if (this.type != "?")
            throw new Error(`DB query syntax error: Query type is already determined (${this.type})`);
        this.type = "update";
        this.tableId = tableId;
        return this;
    }

    from(tableId: string): DBQuery<T>
    {
        if (this.type != "select" && this.type != "delete")
            throw new Error(`DB query syntax error: "from" can only appear in a "select" or "delete" query.`);
        this.tableId = tableId;
        return this;
    }
    set(columnValues: DBRow): DBQuery<T>
    {
        if (this.type != "update")
            throw new Error(`DB query syntax error: Cannot "set" values in a non-update query.`);
        this.columnValues = columnValues;
        return this;
    }
    values(columnValues: DBRow): DBQuery<T>
    {
        if (this.type != "insert")
            throw new Error(`DB query syntax error: Cannot specify "values" in a non-insert query.`);
        this.columnValues = columnValues;
        return this;
    }

    where(columnName: string, operator: DBQueryCondOperator, value: DBColumnType): DBQuery<T>
    {
        if (this.type == "?")
            throw new Error(`DB query syntax error: "where" should not precede "select", "insert", "update", or "delete".`);
        if (columnName == "id" && operator == "==")
            this.docId = value as string;
        else
        {
            this.condGroups[this.condGroups.length - 1].push(
                admin.firestore.Filter.where(columnName, operator, value)
            );
        }
        return this;
    }

    or(): DBQuery<T>
    {
        this.condGroups.push([]);
        return this;
    }

    orderBy(columnName: string, direction: "asc" | "desc" = "asc"): DBQuery<T>
    {
        if (this.type != "select")
            throw new Error(`DB query syntax error: "orderBy" can only appear in a "select" query.`);
        this.orderByCommand = {columnName, direction};
        return this;
    }

    limit(limit: number): DBQuery<T>
    {
        if (this.type != "select")
            throw new Error(`DB query syntax error: "limit" can only appear in a "select" query.`);
        this.limitCommand = limit;
        return this;
    }

    offset(offset: number): DBQuery<T>
    {
        if (this.type != "select")
            throw new Error(`DB query syntax error: "offset" can only appear in a "select" query.`);
        this.offsetCommand = offset;
        return this;
    }

    async run(): Promise<DBQueryResponse<T>>
    {
        LogUtil.log("DB Query Started", this.getStateAsObject(), "low");

        try {
            const db = await FirebaseUtil.getDB();
            let collectionRef = db.collection(this.tableId);
            const docRef = this.docId ? collectionRef.doc(this.docId) : undefined;
            let collectionQuery: admin.firestore.Query =
                (this.condGroups[0].length > 0)
                // At least 1 condition found:
                ? collectionRef.where(
                    (this.condGroups.length == 1)
                    // No "OR" conjunction found:
                    ? ((this.condGroups[0].length == 1)
                        // There is only 1 condition:
                        ? this.condGroups[0][0]
                        // There are multiple conditions:
                        : admin.firestore.Filter.and(...this.condGroups[0]))
                    // "OR" conjunction found:
                    : admin.firestore.Filter.or(
                        // (For each group of conditions):
                        ...this.condGroups.map(condGroup =>
                            (condGroup.length == 1)
                            // Only 1 condition found within the group:
                            ? condGroup[0]
                            // Multiple conditions found within the group:
                            : admin.firestore.Filter.and(...condGroup))))
                // No condition found:
                : collectionRef;

            if (this.orderByCommand)
                collectionQuery = collectionQuery.orderBy(this.orderByCommand.columnName, this.orderByCommand.direction);
            if (this.limitCommand)
                collectionQuery = collectionQuery.limit(this.limitCommand);
            if (this.offsetCommand)
                collectionQuery = collectionQuery.offset(this.offsetCommand);

            switch (this.type)
            {
                case "select": return await runQuerySelect(this, docRef, collectionQuery);
                case "insert": return await runQueryInsert(this, collectionRef);
                case "update": return await runQueryUpdate(this, docRef, collectionQuery);
                case "delete": return await runQueryDelete(this, docRef, collectionQuery);
                default: throw new Error(`Unknown query type: ${this.type}`);
            }
        }
        catch (err) {
            LogUtil.log("DB Query Error", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return { success: false, data: [] };
        }
    }

    getStateAsObject(): any
    {
        return {
            type: this.type,
            tableId: this.tableId,
            columnValues: this.columnValues,
            conditions: this.condGroups.map(
                condGroup => `(${condGroup.map(cond => getCondStr(cond)).join(" AND ")})`
            ).join(" OR "),
        };
    }
}

function getCondStr(cond: admin.firestore.Filter): string
{
    const condObj = cond as any;
    return `${condObj.field} ${condObj.operator} ${condObj.value}`;
}