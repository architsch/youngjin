import dns from "dns/promises";
import https from "https";
import net from "net";

// What no fetch made on a stranger's word may reach: this machine, private networks and the like.
const BLOCKED_ADDRESSES = new net.BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
    ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const)
{
    BLOCKED_ADDRESSES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [["::", 127], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["100::", 64], ["2001::", 32],
    ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const)
{
    BLOCKED_ADDRESSES.addSubnet(address, prefix, "ipv6");
}

const PublicFetchUtil =
{
    // A small JSON document from a public HTTPS address: never a private one, whatever its name resolves to, no redirect
    // followed, nothing past maxBytes. Undefined on any failure.
    fetchJSON: async (url: string, maxBytes: number, timeoutMs: number): Promise<unknown | undefined> =>
    {
        let parsed: URL;
        try
        {
            parsed = new URL(url);
        }
        catch
        {
            return undefined;
        }
        if (parsed.protocol != "https:" || parsed.username.length > 0 || parsed.password.length > 0)
            return undefined;

        const host = parsed.hostname.replace(/^\[|\]$/g, "");
        let addresses: {address: string, family: number}[];
        try
        {
            addresses = (net.isIP(host) != 0) ? [{address: host, family: net.isIP(host)}]
                : await dns.lookup(host, {all: true});
        }
        catch
        {
            return undefined;
        }
        if (addresses.length == 0 || addresses.some(({address, family}) =>
            BLOCKED_ADDRESSES.check(address, family == 6 ? "ipv6" : "ipv4")))
        {
            return undefined;
        }

        const pinned = addresses[0];
        return await new Promise(resolve => {
            const timer = setTimeout(() => request.destroy(), timeoutMs);
            const finish = (value: unknown | undefined) => {
                clearTimeout(timer);
                resolve(value);
            };
            const request = https.get(parsed, {
                headers: {"Accept": "application/json"},
                // The connection goes to the address checked above, whatever the name resolves to by then.
                lookup: ((_hostname: string, options: {all?: boolean}, callback: Function) => (options.all == true)
                    ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family)) as any,
            }, response => {
                if (response.statusCode != 200)
                {
                    response.resume();
                    finish(undefined);
                    return;
                }
                let body = "";
                response.setEncoding("utf8");
                response.on("data", (chunk: string) => {
                    body += chunk;
                    if (body.length > maxBytes)
                        request.destroy();
                });
                response.on("end", () => {
                    try
                    {
                        finish(JSON.parse(body));
                    }
                    catch
                    {
                        finish(undefined);
                    }
                });
                response.on("error", () => finish(undefined));
                // Also after a body cut off past maxBytes (a settled promise ignores it after "end").
                response.on("close", () => finish(undefined));
            });
            request.on("error", () => finish(undefined));
        });
    },
}

export default PublicFetchUtil;
