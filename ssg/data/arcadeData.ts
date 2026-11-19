import type GameEntry from "../types/gameEntry.ts";
import { URL_ROBOT_ROOMS } from "../siteConstants.ts";

export const ArcadeData: {
    gameEntries: GameEntry[]
} = {
    gameEntries: [
        {
            dirName: "RobotRooms",
            title: "Robot Rooms",
            playLinkURL: URL_ROBOT_ROOMS,
            lastmod: "2026-11-18",
            shareImage: {
                path: "share_app.jpg",
                width: 1200,
                height: 630,
                alt: "A fully immersive 3D sandbox metaverse of Robot Rooms, which includes interactive 3D chat rooms, "
                    + "digital art exhibition areas, customizable avatars, and real-time multiplayer gameplay experience.",
            },
        },
        {
            dirName: "ArtRaider",
            title: "ArtRaider",
            playLinkImagePathOverride: "badge_onestore.png",
            playLinkURL: "https://onesto.re/0001000383",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/RuLgOJrNtKA?si=Ts_Yu_jdpB1qmNiT" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
            lastmod: "2025-04-15",
        },
        {
            dirName: "Water-vs-Fire",
            title: "Water vs Fire",
            playLinkURL: "https://www.gamearter.com/game/water-vs-fire",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/6DeA_m8Iq4M?si=hC1uzkEtBWpYcM8z" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "HuntLand",
            title: "HuntLand",
            playLinkURL: "https://www.gamearter.com/game/huntland",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/3dRg6vvoPqc?si=FlnKVyzQq0_55sL2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "PoliceChase",
            title: "Police Chase",
            playLinkURL: "https://www.gamearter.com/game/policechase",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/kABg0j2mZqQ?si=3-JUZQnh3omVXSJd" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "SpaceTown",
            title: "SpaceTown",
            playLinkURL: "https://www.gamearter.com/game/spacetown",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/NoiQzEKJM-A?si=o8vTNqW1kxCJ4MnW" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-20",
        },
    ]
};