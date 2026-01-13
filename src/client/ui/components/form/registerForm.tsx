import { useCallback, useState } from "react";
import Spacer from "../basic/spacer";
import Button from "../basic/button";
import AuthInputValidator from "../../../../shared/auth/util/authInputValidator";
import FormTextInput from "../basic/formTextInput";
import AuthClient from "../../../networking/authClient";
import { localize } from "../../../../shared/localization/util/locUtil";
import { endClientProcess, tryStartClientProcess } from "../../../system/types/clientProcess";
import Text from "../basic/text";

export default function RegisterForm({ onCancel }: RegisterFormProps)
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
        const userNameError = AuthInputValidator.findErrorInUserName(userNameInput);
        if (userNameError)
        {
            alert(localize(userNameError));
            endClientProcess("formSubmit");
            return;
        }
        const passwordError = AuthInputValidator.findErrorInPassword(passwordInput);
        if (passwordError)
        {
            alert(localize(passwordError));
            endClientProcess("formSubmit");
            return;
        }
        const res = await AuthClient.register(userNameInput, passwordInput);
        if (!res.status || res.status < 200 || res.status >= 300)
        {
            alert((res as any).data ?? "Unknown Error");
            endClientProcess("formSubmit");
            return;
        }
        window.location.reload();
    }, [userNameInput, passwordInput, confirmPasswordInput]);

    return <div className="flex flex-col gap-2">
        <Text content="Sign Up" size="lg"/>
        <FormTextInput label="Username:"
            textInput={userNameInput} setTextInput={setUserNameInput}
            filterTextInput={AuthInputValidator.sanitizeUserName}
        />
        <FormTextInput label="Password:" type="password"
            textInput={passwordInput} setTextInput={setPasswordInput}
            filterTextInput={AuthInputValidator.sanitizePassword}
        />
        <FormTextInput label="Confirm Password:" type="password"
            textInput={confirmPasswordInput} setTextInput={setConfirmPasswordInput}
            filterTextInput={AuthInputValidator.sanitizePassword}
        />
        <Spacer size="md"/>
        <div className="flex flex-row gap-2">
            <Button name="Sign Up" size="md" color="green" onClick={onSubmit}/>
            <Button name="Cancel" size="md" color="red" onClick={onCancel}/>
        </div>
    </div>
}

interface RegisterFormProps
{
    onCancel: () => void;
}