// A category a subfolder's images are browsed by, as a chooser tab (see ImageMapSubfolderTab.categories). An image is
// in it when its keywords hold its name marked as a category ("kitchen*", see ImageMap.CATEGORY_MARK), which the
// admin's settings put there (see ImageMapSettings).
export default interface ImageMapCategory
{
    name: string;
    title: string;
}
