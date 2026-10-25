import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import AddressUtil from "../../networking/util/addressUtil";
import EJSUtil from "../../ssg/util/ejsUtil";
import { AGENT_MCP_ROUTE_PATH, AGENT_MCP_SIGNED_IN_ROUTE_PATH, AGENT_NAME_MAX_LENGTH, AGENT_NAME_MIN_LENGTH,
    AGENT_OAUTH_CODE_TTL_MS, AGENT_OAUTH_REQUEST_TTL_MS, AGENT_OAUTH_ROUTE_PATH, AGENT_OAUTH_SCOPE,
    URL_STATIC } from "../../system/serverConstants";
import AgentOAuthClient from "../types/agentOAuthClient";
import AgentAccountUtil from "./agentAccountUtil";
import AgentOAuthClientUtil from "./agentOAuthClientUtil";

// Beyond this many consent pages awaiting an answer, the oldest are let go.
const MAX_PENDING_REQUESTS = 5000;

const NOT_SIGNED_IN = "Sign in to play: a host that signs in (OAuth) does so here on its own. Or call register for a "
    + "key, and send it as the header \"Authorization: Bearer <key>\".";

// Consent pages shown and not yet answered, by request id.
const pendingRequests: {[requestID: string]: {client: AgentOAuthClient, redirectURI: string, codeChallenge: string,
    state: string, resource: string, csrfToken: string, expiresAt: number}} = {};
// Codes not yet exchanged for a token, each good once.
const pendingCodes: {[code: string]: {clientID: string, redirectURI: string, codeChallenge: string, resource: string,
    key: string, expiresAt: number}} = {};

// The OAuth 2.1 by which hosts that sign in (Claude, ChatGPT, editors) connect an agent without anyone copying a key, as
// the MCP authorization spec has it: the person running the agent names a new one on a consent page, or gives the key of
// one they have, and the host is given that agent's key as its token, every agent's key being a bearer token already.
// Accounts are made on that page, in the person's own browser, so the caps on making them (see GuestCreationLimitUtil)
// fall on that person rather than on the host's shared addresses.
const AgentOAuthUtil =
{
    // RFC 9728: an endpoint, and who signs its requests in. Each endpoint has its own (see challenge).
    serveProtectedResourceMetadata: (signedInEndpoint: boolean) => (_req: Request, res: Response): void =>
    {
        res.set("Access-Control-Allow-Origin", "*").json({
            resource: getEndpointURL(signedInEndpoint),
            authorization_servers: [getIssuer()],
            scopes_supported: [AGENT_OAUTH_SCOPE],
            bearer_methods_supported: ["header"],
            resource_name: "ThingsPool",
            resource_documentation: `${URL_STATIC}/skill.md`,
        });
    },
    // RFC 8414.
    serveAuthorizationServerMetadata: (_req: Request, res: Response): void =>
    {
        const base = `${getIssuer()}/${AGENT_OAUTH_ROUTE_PATH}`;
        res.set("Access-Control-Allow-Origin", "*").json({
            issuer: getIssuer(),
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            registration_endpoint: `${base}/register`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"],
            scopes_supported: [AGENT_OAUTH_SCOPE],
            client_id_metadata_document_supported: true,
            authorization_response_iss_parameter_supported: true,
        });
    },
    // RFC 7591, for clients that send no metadata document.
    registerClient: async (req: Request, res: Response): Promise<void> =>
    {
        const result = await AgentOAuthClientUtil.register(req.body);
        if ("error" in result)
        {
            res.status(400).json({error: "invalid_client_metadata", error_description: result.error});
            return;
        }
        res.status(201).json({client_id: result.client.clientID, client_id_issued_at: Math.floor(Date.now() / 1000),
            client_name: result.client.name, redirect_uris: result.client.redirectURIs,
            token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"]});
    },
    // The consent page, for an authorization request whose client and redirect check out.
    showConsent: async (req: Request, res: Response): Promise<void> =>
    {
        const query = req.query;
        const clientID = asString(query.client_id);
        const redirectURI = asString(query.redirect_uri);
        // Until the redirect is known to be the client's own, a problem is told here and nobody is sent anywhere.
        const client = (clientID.length > 0) ? await AgentOAuthClientUtil.resolve(clientID) : undefined;
        if (client == undefined)
        {
            renderPage(req, res, {problem: "The app asking to connect couldn't be recognized. Try connecting again from it."});
            return;
        }
        if (!AgentOAuthClientUtil.isRedirectAllowed(client, redirectURI))
        {
            renderPage(req, res, {problem: "The app asked to be sent back somewhere it never named. Nothing was done."});
            return;
        }

        const state = asString(query.state);
        const codeChallenge = asString(query.code_challenge);
        const resource = asString(query.resource) || getEndpointURL(false);
        if (asString(query.response_type) != "code")
            redirectWith(res, redirectURI, {error: "unsupported_response_type", state});
        else if (asString(query.code_challenge_method) != "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge))
            redirectWith(res, redirectURI, {error: "invalid_request", error_description: "PKCE (S256) is required.", state});
        else if (!isResource(resource))
            redirectWith(res, redirectURI, {error: "invalid_target", state});
        else
        {
            prunePending();
            const requestID = crypto.randomBytes(16).toString("hex");
            pendingRequests[requestID] = {client, redirectURI, codeChallenge, state, resource: trimSlash(resource),
                csrfToken: crypto.randomBytes(16).toString("hex"), expiresAt: Date.now() + AGENT_OAUTH_REQUEST_TTL_MS};
            renderConsent(req, res, requestID, "");
        }
    },
    // The answer given on the consent page: a new agent by the name given, or the agent whose key is given.
    decide: async (req: Request, res: Response): Promise<void> =>
    {
        const requestID = asString(req.body?.request_id);
        const pending = pendingRequests[requestID];
        if (pending == undefined || pending.expiresAt < Date.now() || asString(req.body?.csrf_token) != pending.csrfToken)
        {
            renderPage(req, res, {problem: "This page has run out. Connect again from the app."});
            return;
        }
        if (asString(req.body?.decision) != "allow")
        {
            delete pendingRequests[requestID];
            redirectWith(res, pending.redirectURI, {error: "access_denied", state: pending.state});
            return;
        }

        const givenKey = asString(req.body?.key).trim();
        let key: string;
        if (givenKey.length > 0)
        {
            if (await AgentAccountUtil.findByKey(givenKey) == undefined)
            {
                renderConsent(req, res, requestID, "That key belongs to no agent. Check it, or name a new agent instead.");
                return;
            }
            key = givenKey;
        }
        else
        {
            const registered = await AgentAccountUtil.register(asString(req.body?.name), getRef(pending.client),
                req.ip || "unknown", req.headers["user-agent"] || "unknown");
            if ("error" in registered)
            {
                renderConsent(req, res, requestID, registered.error);
                return;
            }
            key = registered.key;
        }

        delete pendingRequests[requestID];
        const code = crypto.randomBytes(32).toString("base64url");
        pendingCodes[code] = {clientID: pending.client.clientID, redirectURI: pending.redirectURI,
            codeChallenge: pending.codeChallenge, resource: pending.resource, key,
            expiresAt: Date.now() + AGENT_OAUTH_CODE_TTL_MS};
        redirectWith(res, pending.redirectURI, {code, state: pending.state});
    },
    // A code exchanged for its agent's key. Long-lived like any key, so no refresh token is given.
    exchangeToken: (req: Request, res: Response): void =>
    {
        res.set("Cache-Control", "no-store").set("Pragma", "no-cache").set("Access-Control-Allow-Origin", "*");
        const body = req.body ?? {};
        if (asString(body.grant_type) != "authorization_code")
        {
            res.status(400).json({error: "unsupported_grant_type"});
            return;
        }
        // A code is spent by any try, good or bad, so that one leaked can't be tried again.
        const code = asString(body.code);
        const pending = pendingCodes[code];
        delete pendingCodes[code];
        if (pending == undefined || pending.expiresAt < Date.now() || asString(body.client_id) != pending.clientID
            || asString(body.redirect_uri) != pending.redirectURI || !matchesChallenge(asString(body.code_verifier),
            pending.codeChallenge))
        {
            res.status(400).json({error: "invalid_grant", error_description: "The code is unknown, spent, run out, or "
                + "was asked for by another client, redirect or verifier."});
            return;
        }
        if (asString(body.resource).length > 0 && trimSlash(asString(body.resource)) != pending.resource)
        {
            res.status(400).json({error: "invalid_target"});
            return;
        }
        res.json({access_token: pending.key, token_type: "Bearer", scope: AGENT_OAUTH_SCOPE});
    },
    // The endpoint where every request signs in (AGENT_MCP_SIGNED_IN_ROUTE_PATH), for hosts that sign in from the start.
    requireSignIn: (req: Request, res: Response, next: NextFunction): void =>
    {
        const auth = (req as any).auth?.extra ?? {};
        if (auth.agent != undefined || auth.dbUser != undefined)
            next();
        else
            challenge(req, res, true, auth.keyGiven === true);
    },
    // The endpoint where only what needs a key signs in (AGENT_MCP_ROUTE_PATH): listing the tools and registering need
    // none, so curl and hosts without OAuth go on as before, while a host that signs in is prompted the first time it
    // calls a tool that needs a key. A key that finds no agent is always challenged, so a host holding a spent token
    // signs in again.
    challengeWhereNeeded: (req: Request, res: Response, next: NextFunction): void =>
    {
        const auth = (req as any).auth?.extra ?? {};
        if (auth.agent != undefined || auth.dbUser != undefined)
            next();
        else if (auth.keyGiven === true)
            challenge(req, res, false, true);
        else if (req.body?.method == "tools/call" && req.body?.params?.name != "register")
            challenge(req, res, false, false);
        else
            next();
    },
}

function getIssuer(): string
{
    return AddressUtil.getEnvDynamicURL();
}

function getEndpointURL(signedInEndpoint: boolean): string
{
    return `${getIssuer()}/${signedInEndpoint ? AGENT_MCP_SIGNED_IN_ROUTE_PATH : AGENT_MCP_ROUTE_PATH}`;
}

function isResource(resource: string): boolean
{
    return [getEndpointURL(false), getEndpointURL(true)].includes(trimSlash(resource));
}

function trimSlash(url: string): string
{
    return url.replace(/\/+$/, "");
}

// A 401 that tells a host where to sign in (RFC 9728), and anyone else what to do.
function challenge(req: Request, res: Response, signedInEndpoint: boolean, invalidToken: boolean): void
{
    const metadataURL = `${getIssuer()}/.well-known/oauth-protected-resource/`
        + (signedInEndpoint ? AGENT_MCP_SIGNED_IN_ROUTE_PATH : AGENT_MCP_ROUTE_PATH);
    const params = [`resource_metadata="${metadataURL}"`, `scope="${AGENT_OAUTH_SCOPE}"`];
    if (invalidToken)
        params.push(`error="invalid_token"`);
    res.status(401).set("WWW-Authenticate", `Bearer ${params.join(", ")}`)
        .json({jsonrpc: "2.0", id: req.body?.id ?? null, error: {code: -32001, message: NOT_SIGNED_IN}});
}

// Back to the client, with the authorization's outcome and who gave it (RFC 9207).
function redirectWith(res: Response, redirectURI: string, params: {[key: string]: string | undefined}): void
{
    const url = new URL(redirectURI);
    for (const [key, value] of Object.entries(params))
    {
        if (value != undefined && value.length > 0)
            url.searchParams.set(key, value);
    }
    url.searchParams.set("iss", getIssuer());
    res.redirect(302, url.toString());
}

function matchesChallenge(verifier: string, codeChallenge: string): boolean
{
    return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
        && crypto.createHash("sha256").update(verifier).digest("base64url") == codeChallenge;
}

// The source an agent made through a host is counted under (see AgentAccountUtil.register): the host's name.
function getRef(client: AgentOAuthClient): string
{
    return `oauth-${client.clientID.startsWith("https://") ? new URL(client.clientID).host : client.name || "client"}`;
}

function renderConsent(req: Request, res: Response, requestID: string, error: string): void
{
    const pending = pendingRequests[requestID];
    const client = pending.client;
    renderPage(req, res, {
        requestID, csrfToken: pending.csrfToken, error,
        clientName: client.name,
        clientHost: client.clientID.startsWith("https://") ? new URL(client.clientID).host : "",
        redirectHost: new URL(pending.redirectURI).host || new URL(pending.redirectURI).protocol,
        loopbackOnly: AgentOAuthClientUtil.isLoopbackOnly(client),
        nameMinLength: AGENT_NAME_MIN_LENGTH, nameMaxLength: AGENT_NAME_MAX_LENGTH,
    });
}

// Never shown inside another page, so that nobody can be tricked into allowing a connection there (clickjacking).
function renderPage(req: Request, res: Response, params: {[key: string]: any}): void
{
    res.set("X-Frame-Options", "DENY").set("Content-Security-Policy", "frame-ancestors 'none'");
    EJSUtil.render(req, res, "page/dynamic/agentConsent", {problem: "", ...params});
}

function prunePending(): void
{
    const now = Date.now();
    for (const [requestID, pending] of Object.entries(pendingRequests))
    {
        if (pending.expiresAt < now)
            delete pendingRequests[requestID];
    }
    for (const [code, pending] of Object.entries(pendingCodes))
    {
        if (pending.expiresAt < now)
            delete pendingCodes[code];
    }
    const requestIDs = Object.keys(pendingRequests);
    for (const requestID of requestIDs.slice(0, Math.max(0, requestIDs.length - MAX_PENDING_REQUESTS)))
        delete pendingRequests[requestID];
}

function asString(value: unknown): string
{
    return (typeof value == "string") ? value : "";
}

export default AgentOAuthUtil;
