// A thing a helper looks at and says something of (see HelperBehaviorUtil.findSights), as whoever plays it describes it
// to what finds its words (see HelperRemarkUtil): its type, and the picture it shows, its light's color (a place in the
// light palette) or the words written on it, where it has them.
type HelperRemarkSubject = {
    objectType: string,
    picture?: string,
    color?: number,
    text?: string,
};

export default HelperRemarkSubject;
