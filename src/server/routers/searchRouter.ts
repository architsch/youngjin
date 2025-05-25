import authUtil from "../util/authUtil";
import networkUtil from "../util/networkUtil";
import dbSearch from "../db/dbSearch";
import express from "express";
import { Request, Response } from "express";

const router = express.Router();

const validateSearchParams = (req: Request, res: Response): {user: user, page: number} | null => {
    const user = authUtil.getUserFromReqToken(req);
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
router.get("/rooms/owned", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichIOwn(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/joined", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichIJoined(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/invited", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichInvitedMe(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/requested", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichIRequestedToJoin(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/pending", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichIAmPendingToJoin(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/associated", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.whichIAmAssociatedWith(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/others", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.rooms.others(searchParams.user.userID, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

//------------------------------------------------------------------------------------
// Search for Users
//------------------------------------------------------------------------------------

// query strings: {roomid, page}
router.get("/users/joined", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.whoJoinedRoom(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/invited", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.whoAreInvitedToJoinRoom(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/requested", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.whoRequestedToJoinRoom(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/pending", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.whoArePendingToJoinRoom(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/associated", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.whoAreAssociatedWithRoom(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/others", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const searchParams = validateSearchParams(req, res);
    if (!searchParams)
        return;
    const results = await dbSearch.users.others(req.query.roomid as string, searchParams.page, res);
    networkUtil.onRouteResponse(res, results);
});

export default router;