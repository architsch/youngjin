import { useCallback, useState } from "react";
import Spacer from "../basic/spacer";
import Button from "../basic/button";
import UserInputValidator from "../../../../shared/user/util/userInputValidator";
import FormTextInput from "../basic/formTextInput";
import UserAPIClient from "../../../networking/client/userAPIClient";
import { localize } from "../../../../shared/localization/util/locUtil";
import { endClientProcess, tryStartClientProcess } from "../../../system/types/clientProcess";
import Text from "../basic/text";
import Form from "../basic/form";

export default function RegisterWithPasswordForm({ onCancel }: Props)
{
    const [userNameInput, setUserNameInput] = useState<string>("");
    const [passwordInput, setPasswordInput] = useState<string>("");
    const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>("");

    const onSubmit = useCallback(async () => {
        if (!tryStartClientProcess("formSubmit", 1, 2))
        {
            return;
        }
        if (passwordInput != confirmPasswordInput)
        {
            alert("Passwords do not match.");
            endClientProcess("formSubmit");
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
        const res = await UserAPIClient.registerWithPassword(userNameInput, passwordInput);
        if (!res.status || res.status < 200 || res.status >= 300)
        {
            alert(`${res.data} (${res.status})`);
            endClientProcess("formSubmit");
            return;
        }
        window.location.reload();
    }, [userNameInput, passwordInput, confirmPasswordInput]);

    return <Form>
        <Text content="Sign Up" size="lg"/>
        <FormTextInput label="Username:"
            textInput={userNameInput} setTextInput={setUserNameInput}
            filterTextInput={UserInputValidator.sanitizeUserName}
        />
        <FormTextInput label="Password:" type="password"
            textInput={passwordInput} setTextInput={setPasswordInput}
            filterTextInput={UserInputValidator.sanitizePassword}
        />
        <FormTextInput label="Confirm Password:" type="password"
            textInput={confirmPasswordInput} setTextInput={setConfirmPasswordInput}
            filterTextInput={UserInputValidator.sanitizePassword}
        />
        <Spacer size="md"/>
        <div className="flex flex-row gap-2">
            <Button name="Sign Up" size="md" color="green" onClick={onSubmit}/>
            <Button name="Cancel" size="md" color="red" onClick={onCancel}/>
        </div>
    </Form>
}

interface Props
{
    onCancel: () => void;
}