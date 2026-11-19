import App from "../../../../app";
import Button from "../../input/button";
import PopupUtil from "../../../util/popupUtil";
import SelectionToolRow from "./selectionToolRow";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";

// Who the user is: their name, and signing in (a guest) or into another account (a member).
export default function UserIdentityRow()
{
    const user = App.getUser();
    const signedIn = user.userType != UserTypeEnumMap.Guest;

    return <SelectionToolRow>
        <div className="shrink-0 whitespace-nowrap text-base text-gray-100 select-none">
            Your Name: <span className="font-bold text-amber-300 text-shadow-md text-shadow-black">{user.userName}</span>
        </div>
        <Button id="signInButton" name={signedIn ? "Change Account" : "Sign In"} size="md" additionalClassNames="shrink-0"
            onClick={() => PopupUtil.openPopup({popupType: "authPrompt"})}/>
    </SelectionToolRow>;
}
