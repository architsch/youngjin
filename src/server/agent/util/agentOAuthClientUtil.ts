import crypto from "crypto";
import PublicFetchUtil from "../../networking/util/publicFetchUtil";
import DBOAuthClientUtil from "../../db/util/dbOAuthClientUtil";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import AgentOAuthClient from "../types/agentOAuthClient";

const METADATA_DOCUMENT_MAX_BYTES = 5 * 1024;
const METADATA_DOCUMENT_TIMEOUT_MS = 5000;
const METADATA_DOCUMENT_TTL_MS = 10 * MINUTE_IN_MS;
// Beyond this many clients read from documents, the cache starts over, so a stream of made-up URLs can't grow it.
const METADATA_DOCUMENT_CACHE_MAX_SIZE = 200;
const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 512;
const MAX_CLIENT_NAME_LENGTH = 100;
// Schemes no redirect may use, an app's own scheme (as "cursor:") being allowed.
const UNSAFE_REDIRECT_SCHEMES = ["javascript:", "data:", "file:", "vbscript:", "about:", "blob:"];
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

const metadataDocumentClients: {[clientID: string]: {client: AgentOAuthClient, expiresAt: number}} = {};
const registeredClients: {[clientID: string]: AgentOAuthClient} = {};

// The clients of the agents' OAuth (see AgentOAuthUtil): each known by the URL of its metadata document (a Client ID
// Metadata Document, as Claude, ChatGPT and editors send) or by an id it was given on registering itself (Dynamic Client
// Registration, RFC 7591). Every client is public, proving itself by PKCE rather than a secret.
const AgentOAuthClientUtil =
{
    // Undefined if it can't be known.
    resolve: async (clientID: string): Promise<AgentOAuthClient | undefined> =>
    {
        if (clientID.startsWith("https://"))
            return await readMetadataDocument(clientID);
        if (!/^tp_[0-9a-f]{32}$/.test(clientID))
            return undefined;
        if (registeredClients[clientID] == undefined)
        {
            const stored = await DBOAuthClientUtil.get(clientID);
            if (stored == undefined)
                return undefined;
            registeredClients[clientID] = {clientID, ...stored};
        }
        return registeredClients[clientID];
    },
    // One of the client's own, exactly, but for the port of one on the user's own computer, which an app there picks
    // anew each time (RFC 8252).
    isRedirectAllowed: (client: AgentOAuthClient, redirectURI: string): boolean =>
    {
        return client.redirectURIs.some(allowed => allowed == redirectURI
            || (isLoopback(allowed) && isLoopback(redirectURI) && withoutPort(allowed) == withoutPort(redirectURI)));
    },
    // Whether every place it may be sent back to is on the user's own computer: an app there, rather than a website.
    isLoopbackOnly: (client: AgentOAuthClient): boolean =>
    {
        return client.redirectURIs.every(isLoopback);
    },
    // The client made from what it registers with, or why it was refused.
    register: async (metadata: any): Promise<{client: AgentOAuthClient} | {error: string}> =>
    {
        const redirectURIs = metadata?.redirect_uris;
        if (!Array.isArray(redirectURIs) || redirectURIs.length == 0 || redirectURIs.length > MAX_REDIRECT_URIS
            || !redirectURIs.every(isAcceptableRedirect))
        {
            return {error: `redirect_uris must be 1 to ${MAX_REDIRECT_URIS} addresses, each https, http on the user's own `
                + `computer, or an app's own scheme.`};
        }
        if ((metadata.token_endpoint_auth_method ?? "none") != "none")
            return {error: "Only public clients are registered (token_endpoint_auth_method \"none\"), proving themselves by PKCE."};

        const name = (typeof metadata.client_name == "string") ? metadata.client_name.slice(0, MAX_CLIENT_NAME_LENGTH) : "";
        const clientID = `tp_${crypto.randomBytes(16).toString("hex")}`;
        if (!await DBOAuthClientUtil.create(clientID, name, redirectURIs))
            return {error: "The client couldn't be registered. Try again later."};
        registeredClients[clientID] = {clientID, name, redirectURIs};
        return {client: registeredClients[clientID]};
    },
}

// A client by the document at its URL, which must name that very URL as its id.
async function readMetadataDocument(url: string): Promise<AgentOAuthClient | undefined>
{
    const cached = metadataDocumentClients[url];
    if (cached != undefined && cached.expiresAt > Date.now())
        return cached.client;

    const document = await PublicFetchUtil.fetchJSON(url, METADATA_DOCUMENT_MAX_BYTES, METADATA_DOCUMENT_TIMEOUT_MS) as any;
    const redirectURIs = document?.redirect_uris;
    if (document?.client_id !== url || !Array.isArray(redirectURIs) || redirectURIs.length == 0
        || redirectURIs.length > MAX_REDIRECT_URIS || !redirectURIs.every(isAcceptableRedirect))
    {
        return undefined;
    }

    const client = {clientID: url, redirectURIs,
        name: (typeof document.client_name == "string") ? document.client_name.slice(0, MAX_CLIENT_NAME_LENGTH)
            : new URL(url).host};
    if (Object.keys(metadataDocumentClients).length >= METADATA_DOCUMENT_CACHE_MAX_SIZE)
        for (const key of Object.keys(metadataDocumentClients))
            delete metadataDocumentClients[key];
    metadataDocumentClients[url] = {client, expiresAt: Date.now() + METADATA_DOCUMENT_TTL_MS};
    return client;
}

function isAcceptableRedirect(uri: unknown): boolean
{
    if (typeof uri != "string" || uri.length > MAX_REDIRECT_URI_LENGTH)
        return false;
    const parsed = parseURL(uri);
    if (parsed == undefined || parsed.hash.length > 0 || UNSAFE_REDIRECT_SCHEMES.includes(parsed.protocol))
        return false;
    // http only to the user's own computer.
    return parsed.protocol != "http:" || isLoopback(uri);
}

function isLoopback(uri: string): boolean
{
    const parsed = parseURL(uri);
    return parsed != undefined && parsed.protocol == "http:" && LOOPBACK_HOSTS.includes(parsed.hostname);
}

function withoutPort(uri: string): string
{
    const parsed = parseURL(uri)!;
    parsed.port = "";
    return parsed.toString();
}

function parseURL(uri: string): URL | undefined
{
    try
    {
        return new URL(uri);
    }
    catch
    {
        return undefined;
    }
}

export default AgentOAuthClientUtil;
