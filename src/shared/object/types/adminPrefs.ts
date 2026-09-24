// An object's admin-only settings, stored as its AdminPrefs metadata (see AdminPrefsUtil).
export default interface AdminPrefs
{
    // A player nobody sees, its owner included: neither its body nor its speech bubble is drawn.
    ghostMode: boolean;
}
