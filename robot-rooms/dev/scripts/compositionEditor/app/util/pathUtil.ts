// Reads and immutable writes at a path of keys into plain JSON. A write copies only the containers along the
// path, so everything else keeps its identity (which is what lets per-entry encodings be cached).
const PathUtil =
{
    get: (root: any, path: (string | number)[]): any =>
    {
        let node = root;
        for (const key of path)
        {
            if (node == undefined || typeof node != "object")
                return undefined;
            node = node[key];
        }
        return node;
    },

    set: (root: any, path: (string | number)[], value: any): any =>
    {
        if (path.length == 0)
            return value;
        const [key, ...rest] = path;
        const copy = copyContainer(root, typeof key == "number");
        copy[key as any] = PathUtil.set(copy[key as any], rest, value);
        return copy;
    },

    // Containers emptied by the removal go too, down to (not including) the first keepDepth keys of the path.
    remove: (root: any, path: (string | number)[], keepDepth: number = 0): any =>
    {
        if (path.length == 0 || root == undefined || typeof root != "object")
            return root;
        const [key, ...rest] = path;
        const copy = copyContainer(root, Array.isArray(root));
        if (rest.length == 0)
        {
            if (Array.isArray(copy))
                copy.splice(key as number, 1);
            else
                delete copy[key];
            return copy;
        }
        const child = PathUtil.remove(copy[key as any], rest, keepDepth - 1);
        if (keepDepth <= 0 && isEmptyRecord(child))
            delete copy[key as any];
        else
            copy[key as any] = child;
        return copy;
    },

    // "colors.frame" -> ["colors", "frame"]
    split: (dottedPath: string): string[] =>
    {
        return dottedPath.split(".");
    },
}

export default PathUtil;

function copyContainer(node: any, asArray: boolean): any
{
    if (Array.isArray(node))
        return [...node];
    if (node != undefined && typeof node == "object")
        return {...node};
    return asArray ? [] : {};
}

function isEmptyRecord(value: any): boolean
{
    return value != undefined && typeof value == "object" && !Array.isArray(value) && Object.keys(value).length == 0;
}
