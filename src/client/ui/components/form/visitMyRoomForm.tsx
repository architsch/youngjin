import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import Form from "../basic/form";
import User from "../../../../shared/user/types/user";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import SocketsClient from "../../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../../shared/room/types/requestRoomChangeSignal";

export default function VisitMyRoomForm({ user, onCancel }: Props)
{
    return <Form>
        <Text content="Want to visit your room?" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Yes" size="md" color="green" onClick={() => visitMyRoom(user, onCancel)}/>
        <Button name="No" size="md" onClick={onCancel}/>
    </Form>
}

async function visitMyRoom(user: User, onCancel: () => void): Promise<void>
{
    if (user.ownedRoomID.length === 0)
    {
        // User doesn't own a room yet — create one first
        const response = await RoomAPIClient.createRoom();
        if (response.status >= 200 && response.status < 300 && response.data.roomID)
        {
            const roomID = response.data.roomID;
            user.ownedRoomID = roomID;
            onCancel();
            SocketsClient.tryEmitRequestRoomChangeSignal(new RequestRoomChangeSignal(roomID));
        }
        else
        {
            onCancel();
            alert("Failed to create room. Please try again.");
        }
    }
    else
    {
        // User already owns a room — visit it
        onCancel();
        SocketsClient.tryEmitRequestRoomChangeSignal(new RequestRoomChangeSignal(user.ownedRoomID));
    }
}

interface Props
{
    user: User;
    onCancel: () => void;
}
