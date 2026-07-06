export default interface ImageMetadata
{
    // path = (relative path under the root directory, but excluding the file extension)
    // The name of the root directory is given by rootDirName (in ImageMap),
    // and the root directory is located right under the app's assets_url (in ThingsPoolEnv).
    path: string;

    author: string;
    title: string;

    // coords = {subfolderName},{col},{row}
    // (subfolderName == "") if there is no subfolder.
    coords?: string;
}