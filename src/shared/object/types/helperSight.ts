import HelperRemarkSubject from "./helperRemarkSubject";

// One of the things placed in its room that a helper could go and look at now (see HelperBehaviorUtil.findSights).
type HelperSight = {
    objectId: string,
    subject: HelperRemarkSubject,
};

export default HelperSight;
