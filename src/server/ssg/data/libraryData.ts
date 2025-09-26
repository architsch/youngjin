import PostEntry from "../types/postEntry"

export const LibraryData: {
    entriesByCategory: { [category: string]: PostEntry[] }
} = {
    entriesByCategory : {
        "Nonfiction": [
            { dirName: "metaphysics", title: "형이상학 (2013 - 2014)"},
            { dirName: "game-analysis", title: "게임분석 (2019)"},
            { dirName: "essays", title: "Miscellaneous Writings (2022 - 2024)"},
            { dirName: "blockchains", title: "On Legitimacy of Blockchains (2022)"},
            { dirName: "software-development", title: "Software Development (2022 - 2024)"},
            { dirName: "game-design", title: "Universal Laws of Game Design (2023)"},
            { dirName: "reality", title: "The Origin of Reality (2023)"},
            { dirName: "bridge-to-math", title: "A Layman's Bridge to Mathematics (2024)"},
            { dirName: "read-rec", title: "Recommended Readings (2024)"},
            { dirName: "morsels", title: "Morsels of Thought (2024)"},
            { dirName: "concepts-of-plan", title: "Concepts of a Plan (2025)"},
        ],
        "Fiction": [
            { dirName: "novels", title: "단편소설 (2012 - 2013)"},
            { dirName: "alien-job-interview", title: "Alien Job Interview (2022)"},
            { dirName: "infinite-treasures", title: "The Island of Infinite Treasures (2022)"},
            { dirName: "infsoc", title: "Influential Social Posts (2023)"},
            { dirName: "gamedev-journey", title: "A Game Developer's Journey (2023)"},
            { dirName: "sandwich", title: "Sandwich Engineering (2025)"},
        ],
        "Arts": [
            { dirName: "illustrations", title: "Illustrations (2009 - 2014)"},
            { dirName: "cartoons", title: "Cartoons (2011 - 2015)"},
        ],
    }
};