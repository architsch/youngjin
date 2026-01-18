import { useCallback, useState } from "react";
import Spacer from "../basic/spacer";
import Button from "../basic/button";
import UserInputValidator from "../../../../shared/user/util/userInputValidator";
import FormTextInput from "../basic/formTextInput";
import UserAPIClient from "../../../networking/client/userAPIClient";
import { localize } from "../../../../shared/localization/util/locUtil";
import { endClientProcess, tryStartClientProcess } from "../../../system/types/clientProcess";
import Text from "../basic/text";

export default function LoginWithPasswordForm({ onCancel }: Props)
{
    const [userNameInput, setUserNameInput] = useState<string>("");
    const [passwordInput, setPasswordInput] = useState<string>("");

    const onSubmit = useCallback(async () => {
        if (!tryStartClientProcess("formSubmit", 1, 2))
        {
            return;
        }
        const userNameError = UserInputValidator.findErrorInUserName(userNameInput);
        if (userNameError)
        {
            alert(localize(userNameError));
            endClientProcess("formSubmit");
            return;
        }
        const passwordError = UserInputValidator.findErrorInPassword(passwordInput);
        if (passwordError)
        {
            alert(localize(passwordError));
            endClientProcess("formSubmit");
            return;
        }
        const res = await UserAPIClient.loginWithPassword(userNameInput, passwordInput);
        if (!res.status || res.status < 200 || res.status >= 300)
        {
            alert(`${res.data} (${res.status})`);
            endClientProcess("formSubmit");
            return;
        }
        window.location.reload();
    }, [userNameInput, passwordInput]);

    return <div className="flex flex-col gap-2">
        <Text content="Log In" size="lg"/>
        <FormTextInput label="Username:"
            textInput={userNameInput} setTextInput={setUserNameInput}
            filterTextInput={UserInputValidator.sanitizeUserName}
        />
        <FormTextInput label="Password:" type="password"
            textInput={passwordInput} setTextInput={setPasswordInput}
            filterTextInput={UserInputValidator.sanitizePassword}
        />
        <Spacer size="md"/>
        <div className="flex flex-row gap-2">
            <Button name="Log In" size="md" color="green" onClick={onSubmit}/>
            <Button name="Cancel" size="md" color="red" onClick={onCancel}/>
        </div>
    </div>
}

interface Props
{
    onCancel: () => void;
}