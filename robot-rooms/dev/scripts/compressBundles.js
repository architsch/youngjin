// Writes a .gz and a .br copy of everything Nginx serves straight off disk, so it can hand over a
// pre-compressed file instead of compressing the same bundle again on every request (see
// `gzip_static` in dev/config/nginx_default.txt).
//
// The copies are build output, not source: they are gitignored, and the deploy workflow ships them
// to the VPS alongside the bundles they belong to.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CLIENT_DIR = path.join(__dirname, "../../dist/client");

// Anything below this compresses to more bytes than it saves round trips.
const MIN_BYTES = 1024;

function compress(fileName)
{
    const filePath = path.join(CLIENT_DIR, fileName);
    const source = fs.readFileSync(filePath);

    if (source.length < MIN_BYTES)
        return;

    fs.writeFileSync(`${filePath}.gz`, zlib.gzipSync(source, {level: 9}));
    fs.writeFileSync(`${filePath}.br`, zlib.brotliCompressSync(source, {
        params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
    }));

    const gzSize = fs.statSync(`${filePath}.gz`).size;
    const brSize = fs.statSync(`${filePath}.br`).size;
    const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
    console.log(`  ${fileName}: ${kb(source.length)} -> ${kb(gzSize)} gzip, ${kb(brSize)} brotli`);
}

if (!fs.existsSync(CLIENT_DIR))
{
    console.error(`❌ No client build found at [${CLIENT_DIR}].`);
    process.exit(1);
}

// The live and backup copies belong to the promote/rollback flow, which brings their compressed
// copies across with them rather than making new ones.
const servedFiles = fs.readdirSync(CLIENT_DIR).filter((fileName) =>
    (fileName.endsWith(".js") || fileName.endsWith(".css"))
        && !fileName.includes(".live.") && !fileName.includes(".backup."));

console.log("Pre-compressing client bundles:");
for (const fileName of servedFiles)
    compress(fileName);
