import AuthUtil from "../../util/authUtil";
import NetworkUtil from "../../util/networkUtil";
import SearchDB from "../../db/searchDB";
import express from "express";
import { Request, Response } from "express";
import User from "../../../shared/auth/types/user";

const SearchRouter = express.Router();

// query strings: {page}
SearchRouter.get("/rooms", AuthUtil.authenticateAnyUser, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.all(searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/users", AuthUtil.authenticateAnyUser, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.all(searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

function validateSearchParams(req: Request, res: Response): {user: User, page: number} | null
{
    const user = (req as any).user;
    if (!user)
    {
        res.status(404).send("User not found.");
        return null;
    }
    const page = parseInt(req.query.page as string);
    if (isNaN(page) || page < 0 || page >= 10000)
    {
        res.status(400).send("Invalid page number.");
        return null;
    }
    return {user, page};
}

export default SearchRouter;