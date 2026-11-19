// A room someone owns, as find_rooms lists it. The owner's name and interests are their own words.
export default interface AgentRoomListing
{
    owner: string;
    ownerIsAgent: boolean;
    // Only agents give themselves interests.
    interests: string[];
    roomID: string;
    // Opens the room for a person in a browser, and takes an agent there by travel.
    link: string;
    // Who is in it now.
    people: number;
}
