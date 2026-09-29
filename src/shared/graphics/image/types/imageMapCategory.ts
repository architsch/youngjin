// A category a subfolder's images are browsed by, as a chooser tab (see ImageMapSubfolderTab.categories). An image is
// in it when its keywords hold its name marked as a category ("kitchen*", see ImageMap.CATEGORY_MARK).
export default interface ImageMapCategory
{
    name: string;
    title: string;
}
