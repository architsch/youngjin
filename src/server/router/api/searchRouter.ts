import AuthUtil from "../../util/authUtil";
import NetworkUtil from "../../util/networkUtil";
import SearchDB from "../../db/searchDB";
import express from "express";
import { Request, Response } from "express";

const SearchRouter = express.Router();

const validateSearchParams = (req: Request, res: Response): {user: User, page: number} | null => {
    const user = (req as any).user;
    if (!user)
    {
        res.status(404).send("User not found.");
        return null;
    }
    const page = parseInt(req.query.page as string);
    if (isNaN(page))
    {
        res.status(400).send("Invalid page number.");
        return null;
    }
    return {user, page};
};

//------------------------------------------------------------------------------------
// Search for Rooms
//------------------------------------------------------------------------------------

// query strings: {page}
SearchRouter.get("/rooms/owned", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichIOwn(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/joined", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichIJoined(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/invited", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichInvitedMe(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/requested", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichIRequestedToJoin(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/pending", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichIAmPendingToJoin(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/associated", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.whichIAmAssociatedWith(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {page}
SearchRouter.get("/rooms/others", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.rooms.others(searchParams.user.userID, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

//------------------------------------------------------------------------------------
// Search for Users
//------------------------------------------------------------------------------------

// query strings: {roomid, page}
SearchRouter.get("/users/joined", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.whoJoinedRoom(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
SearchRouter.get("/users/invited", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.whoAreInvitedToJoinRoom(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
SearchRouter.get("/users/requested", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.whoRequestedToJoinRoom(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
SearchRouter.get("/users/pending", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.whoArePendingToJoinRoom(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
SearchRouter.get("/users/associated", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.whoAreAssociatedWithRoom(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
SearchRouter.get("/users/others", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await SearchDB.users.others(req.query.roomid as string, searchParams.page, res);
    NetworkUtil.onRouteResponse(res, results);
});

export default SearchRouter;