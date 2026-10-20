// The site's address in a corner of an agent's camera page (see CameraUIRoot), so that a picture of it says where it
// was taken. Sized with the view, so it reads alike in a screenshot of any size.
export default function Watermark()
{
    return <div className={className}>thingspool.net</div>;
}

const className = "absolute bottom-[clamp(0.5rem,1.5vw,1.5rem)] right-[clamp(0.5rem,1.5vw,1.5rem)] px-[0.6em] py-[0.2em] "
    + "rounded-[0.4em] bg-black/50 text-amber-500 text-[clamp(0.75rem,1.6vw,1.75rem)] pointer-events-none select-none";
