import express from "express";
import AgentMcpUtil from "../../agent/util/agentMcpUtil";
import AgentOAuthUtil from "../../agent/util/agentOAuthUtil";
import FileUtil from "../../ssg/util/fileUtil";
import { AGENT_ICON_FILE, AGENT_MCP_ROUTE_PATH, AGENT_MCP_SIGNED_IN_ROUTE_PATH,
    AGENT_OAUTH_ROUTE_PATH } from "../../system/serverConstants";

// AI agents' endpoint (see @docs/networking/agents.md), and the OAuth by which hosts sign agents in to it (see
// AgentOAuthUtil). Rate limits are the router's mounting's to add.
const AgentRouter = express.Router();

AgentRouter.get(["/.well-known/oauth-protected-resource", `/.well-known/oauth-protected-resource/${AGENT_MCP_ROUTE_PATH}`],
    AgentOAuthUtil.serveProtectedResourceMetadata(false));
AgentRouter.get(`/.well-known/oauth-protected-resource/${AGENT_MCP_SIGNED_IN_ROUTE_PATH}`,
    AgentOAuthUtil.serveProtectedResourceMetadata(true));
AgentRouter.get("/.well-known/oauth-authorization-server", AgentOAuthUtil.serveAuthorizationServerMetadata);
AgentRouter.post(`/${AGENT_OAUTH_ROUTE_PATH}/register`, AgentOAuthUtil.registerClient);
AgentRouter.get(`/${AGENT_OAUTH_ROUTE_PATH}/authorize`, AgentOAuthUtil.showConsent);
AgentRouter.post(`/${AGENT_OAUTH_ROUTE_PATH}/authorize`, AgentOAuthUtil.decide);
AgentRouter.post(`/${AGENT_OAUTH_ROUTE_PATH}/token`, AgentOAuthUtil.exchangeToken);

// The favicon and the icon the endpoint's server info names (see AGENT_ICON_FILE), which hosts look for here.
for (const file of ["favicon.ico", AGENT_ICON_FILE])
    AgentRouter.get(`/${file}`, (req, res) => {
        res.set("Cache-Control", "public, max-age=86400").sendFile(FileUtil.getAbsoluteFilePath(file));
    });

// Signing in asked of every request; only of what needs a key; never of a request with the key in its address, for
// hosts that take only an address. In this order, so that the key route doesn't take the signed-in one's path.
AgentRouter.all(`/${AGENT_MCP_SIGNED_IN_ROUTE_PATH}`, AgentMcpUtil.authenticate, AgentOAuthUtil.requireSignIn,
    AgentMcpUtil.handle);
AgentRouter.all(`/${AGENT_MCP_ROUTE_PATH}`, AgentMcpUtil.authenticate, AgentOAuthUtil.challengeWhereNeeded,
    AgentMcpUtil.handle);
AgentRouter.all(`/${AGENT_MCP_ROUTE_PATH}/:key`, AgentMcpUtil.authenticate, AgentMcpUtil.handle);

export default AgentRouter;
