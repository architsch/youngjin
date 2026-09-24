// An element HTMLUtil.parse recognized, holding only the attributes it was allowed to read.
export default interface HTMLTag
{
    name: string; // Lowercase
    attributes: {[name: string]: string};
}
