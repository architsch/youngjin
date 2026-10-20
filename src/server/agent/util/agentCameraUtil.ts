import crypto from "crypto";
import socketIO from "socket.io";
import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import RoomChangedSignal from "../../../shared/room/types/roomChangedSignal";
import SocketSignalQueue from "../../sockets/types/socketSignalQueue";
import ServerUserManager from "../../user/serverUserManager";
import ServerRoomManager from "../../room/serverRoomManager";
import AddressUtil from "../../networking/util/addressUtil";
import EJSUtil from "../../ssg/util/ejsUtil";
import { AGENT_CAMERA_MAX_PAGES, AGENT_CAMERA_ROUTE_PATH, GIT_COMMIT } from "../../system/serverConstants";
import AgentUserContext from "../types/agentUserContext";
import HelperAgentUtil from "./helperAgentUtil";

// An agent's camera: a page showing a browser, live, what the agent's player sees, as a person's browser shows them in
// play mode, so that an agent with a browser tool can take pictures. It adds nobody to the room: the page is sent what
// the agent is, and the agent's own changes besides (see AgentUserContext.cameras), and nothing it sends is heard.

const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// Who a camera page's client is: nobody, by an id that no user, and so no object, has.
const VIEWER = new User("#camera", "Camera", UserTypeEnumMap.Guest, "", "");

const AgentCameraUtil =
{
    // Made when first asked for, and good while the agent is present.
    getLink: (ctx: AgentUserContext): string =>
    {
        ctx.cameraToken ??= crypto.randomBytes(TOKEN_BYTES).toString("base64url");
        return AgentCameraUtil.getPageURL(ctx.cameraToken);
    },
    // The present agent whose camera a link's token opens.
    findByToken: (token: unknown): AgentUserContext | undefined =>
    {
        if (typeof token != "string" || !TOKEN_PATTERN.test(token))
            return undefined;
        const given = Buffer.from(token);
        for (const ctx of Object.values(ServerUserManager.socketUserContexts))
        {
            if (ctx instanceof AgentUserContext && !ctx.isClosed() && ctx.cameraToken != undefined
                && crypto.timingSafeEqual(Buffer.from(ctx.cameraToken), given))
                return ctx;
        }
        return undefined;
    },
    // The game watching through the agent's eyes, or why it can't. Never a guest's session: a camera is nobody.
    servePage: (req: Request, res: Response): void =>
    {
        res.set("Cache-Control", "no-store");
        const token = req.params.token;
        const ctx = AgentCameraUtil.findByToken(token);
        if (ctx == undefined || req.query.elsewhere != undefined)
        {
            EJSUtil.render(req, res, "page/dynamic/cameraNotice",
                {openedElsewhere: ctx != undefined, maxPages: AGENT_CAMERA_MAX_PAGES});
            return;
        }
        (req as any).userString = VIEWER.toString();
        EJSUtil.render(req, res, "page/dynamic/mypage",
            {gitCommit: GIT_COMMIT, targetRoomID: "", cameraToken: token, watchedUserID: ctx.user.id});
    },
    // A camera page's socket, whose token was found good (see SocketsServer): sent the agent's room at once, and what the
    // agent is sent from then on. One past AGENT_CAMERA_MAX_PAGES sends the oldest page away, to say so.
    admit: (socket: socketIO.Socket, ctx: AgentUserContext): void =>
    {
        // Gone since the token was checked: the page reloads into saying so.
        if (ctx.isClosed() || ServerUserManager.getSocketUserContext(ctx.user.id) != ctx)
        {
            socket.disconnect(true);
            return;
        }

        while (ctx.cameras.length >= AGENT_CAMERA_MAX_PAGES)
        {
            const oldest = ctx.cameras.shift()!;
            oldest.socket.emit("forceRedirect", `${AgentCameraUtil.getPageURL(ctx.cameraToken!)}?elsewhere`);
            oldest.socket.disconnect(true);
        }

        const camera = new SocketSignalQueue(socket);
        ctx.cameras.push(camera);
        socket.on("disconnect", () => {
            const index = ctx.cameras.indexOf(camera);
            if (index >= 0)
                ctx.cameras.splice(index, 1);
        });

        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        const roomRuntimeMemory = (roomID == undefined) ? undefined : ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
            return;
        camera.add("roomChangedSignal", new RoomChangedSignal(roomRuntimeMemory));
        for (const {signalType, signal} of HelperAgentUtil.getCatchUpSignals(roomID))
            camera.add(signalType, signal);
    },
    getPageURL: (token: string): string =>
    {
        return `${AddressUtil.getEnvDynamicURL()}/${AGENT_CAMERA_ROUTE_PATH}/${token}`;
    },
}

export default AgentCameraUtil;
