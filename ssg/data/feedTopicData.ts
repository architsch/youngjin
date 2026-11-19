// Feeds of one topic beside the site's feed of everything, for aggregators that take only their own subject
// (Planet IF reads the narrative one). A post joins a topic by its path here.
export const FeedTopicData: {
    [fileName: string]: { title: string, postPaths: string[] }
} = {
    "narrative.atom": {
        title: "ThingsPool - Narrative",
        postPaths: [
            "shards-of-sanity/page-3.html",
            "shards-of-sanity/page-4.html",
            "shards-of-sanity/page-5.html",
        ],
    },
};
