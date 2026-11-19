/**
 * The preview server (preview.ts), showing the pages in public/ as they are: nothing is built here.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createPreviewServer } from "../preview.ts";
import { URL_STATIC } from "../siteConstants.ts";

describe("the preview", () => {
    const server = createPreviewServer({rebuild: false});
    let origin = "";

    before(async () => {
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    after(() => {
        server.close();
    });

    it("shows a page with its own address in place of the site's, without what only the published site carries", async () => {
        const response = await fetch(`${origin}/library.html`);
        const page = await response.text();
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
        assert.ok(page.includes(`href="${origin}/style.css"`));
        assert.ok(!page.includes(URL_STATIC));
        assert.ok(!page.includes("googletagmanager"));
        assert.ok(!page.includes("og:title"));
    });

    it("shows the home page at its root, and the site's other files as they are", async () => {
        const home = await fetch(`${origin}/`);
        assert.equal(home.status, 200);
        assert.ok((await home.text()).includes("<h1>ThingsPool</h1>"));

        const style = await fetch(`${origin}/style.css`);
        assert.equal(style.status, 200);
        assert.match(style.headers.get("content-type") ?? "", /^text\/css/);

        const picture = await fetch(`${origin}/play.png`);
        assert.equal(picture.status, 200);
        assert.equal(picture.headers.get("content-type"), "image/png");
        await picture.arrayBuffer();
    });

    it("shows the page the site's styles are tried on", async () => {
        const response = await fetch(`${origin}/test-ui`);
        const page = await response.text();
        assert.equal(response.status, 200);
        assert.ok(page.includes("<h1>List Example</h1>"));
        assert.ok(page.includes(`href="${origin}/style.css"`));
    });

    it("shows nothing that is not a file in the site's folder", async () => {
        for (const requestPath of ["/no-such-page.html", "/devlog-2026", "/..%2FCLAUDE.md", "/..%2Fssg%2Fpackage.json"])
        {
            const response = await fetch(`${origin}${requestPath}`);
            assert.equal(response.status, 404, requestPath);
            await response.text();
        }
    });
});
