export default interface PostEntry
{
    dirName: string;
    title: string;
    author?: string; // Name shown on every post page of this list. Defaults to the site owner.
}