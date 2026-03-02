import { useEffect, useState } from "react";
import { notificationMessageObservable } from "../../../system/clientObservables";

const NOTIFICATION_DURATION_MS = 3000;

export default function Notification()
{
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        notificationMessageObservable.addListener("ui.notification", (msg: string | null) => {
            if (timeoutId) clearTimeout(timeoutId);

            setMessage(msg);

            if (msg)
            {
                timeoutId = setTimeout(() => {
                    setMessage(null);
                }, NOTIFICATION_DURATION_MS);
            }
        });

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            notificationMessageObservable.removeListener("ui.notification");
        };
    }, []);

    if (!message) return null;

    return <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="px-4 py-2 text-sm text-gray-200 bg-gray-800 border border-gray-600">
            {message}
        </div>
    </div>;
}
