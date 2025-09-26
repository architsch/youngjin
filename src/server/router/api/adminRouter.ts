import TextUtil from "../../../shared/embeddedScripts/util/textUtil";
import DB from "../../db/db";
import AuthUtil from "../../util/authUtil";
import express from "express";
import { Request, Response } from "express";

const AdminRouter = express.Router();

AdminRouter.get("/db/:table", AuthUtil.authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
    const table: {[name: string]: any}[] =
        await (DB.makeQuery(`SELECT * FROM ${req.params.table};`).run()) as {[name: string]: any}[];

    const tableHeaders: {[name: string]: any} = {};

    const tableRowsHTML = table.map(row =>
        `<tr>${
            Object.entries(row.map((name: string, value: any) => {
                tableHeaders[name] = true;
                return `<td>${value}<td>`;
            })).join("\n  ")
        }</tr>`).join("\n");

    const tableHeadersHTML = Object.keys(tableHeaders).map(header =>
        `<th>${
            TextUtil.escapeHTMLChars(header)
        }</th>`).join("");

    res.status(200)
        .setHeader("content-type", "text/html")
        .send(`<table>\n<tr>${tableHeadersHTML}</tr>\n${tableRowsHTML}\n</table>`);
});

export default AdminRouter;