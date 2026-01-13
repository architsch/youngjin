import { useCallback, useState } from "react";
import Spacer from "../basic/spacer";
import Button from "../basic/button";
import AuthInputValidator from "../../../../shared/auth/util/authInputValidator";
import FormTextInput from "../basic/formTextInput";
import AuthClient from "../../../networking/authClient";
import { localize } from "../../../../shared/localization/util/locUtil";
import { endClientProcess, tryStartClientProcess } from "../../../system/types/clientProcess";
import Text from "../basic/text";

export default function LoginForm({ onCancel }: LoginFormProps)
{
    const [userNameInput, setUserNameInput] = useState<string>("");
    const [passwordInput, setPasswordInput] = useState<string>("");

    const onSubmit = useCallback(async () => {
        console.log("1");
        if (!tryStartClientProcess("formSubmit", 1, 2))
        {
            return;
        }
        console.log("2");
        const userNameError = AuthInputValidator.findErrorInUserName(userNameInput);
        if (userNameError)
        {
            alert(localize(userNameError));
            endClientProcess("formSubmit");
            return;
        }
        console.log("3");
        const passwordError = AuthInputValidator.findErrorInPassword(passwordInput);
        if (passwordError)
        {
            alert(localize(passwordError));
            endClientProcess("formSubmit");
            return;
        }
        console.log("4");
        const res = await AuthClient.login(userNameInput, passwordInput);
        if (!res.status || res.status < 200 || res.status >= 300)
        {
            alert((res as any).data ?? "Unknown Error");
            endClientProcess("formSubmit");
            return;
        }
        console.log("5");
        window.location.reload();
    }, [userNameInput, passwordInput]);

    return <div className="flex flex-col gap-2">
        <Text content="Log In" size="lg"/>
        <FormTextInput label="Username:"
            textInput={userNameInput} setTextInput={setUserNameInput}
            filterTextInput={AuthInputValidator.sanitizeUserName}
        />
        <FormTextInput label="Password:" type="password"
            textInput={passwordInput} setTextInput={setPasswordInput}
            filterTextInput={AuthInputValidator.sanitizePassword}
        />
        <Spacer size="md"/>
        <div className="flex flex-row gap-2">
            <Button name="Log In" size="md" color="green" onClick={onSubmit}/>
            <Button name="Cancel" size="md" color="red" onClick={onCancel}/>
        </div>
    </div>
}

interface LoginFormProps
{
    onCancel: () => void;
}