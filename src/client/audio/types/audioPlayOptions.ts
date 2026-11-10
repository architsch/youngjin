export default interface AudioPlayOptions
{
    volume?: number; // scales the clip's own loudness; 1 if absent
    rate?: number; // how fast it plays, which raises its pitch as much; 1 if absent
}
