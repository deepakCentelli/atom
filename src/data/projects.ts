export interface ProjectFile {

    id: string;

    type: string;

    name: string;

    date: string;

    description: string;

    notes: string;
}

export interface Project {

    id: number;

    name: string;

    date: string;

    description: string;

    progress: number;

    checklist: {
        title: string;
        completed: boolean;
    }[];

    files: ProjectFile[];

}


export const projects: Project[] = [

    {
        id: 1,

        name: "Atom Application",

        date: "02 Aug 2026",

        description:
            "A desktop project management application built with Electron.",

        progress: 65,


        checklist: [

            {
                title: "UI Design",
                completed: true
            },

            {
                title: "Electron Setup",
                completed: true
            },

            {
                title: "File System Integration",
                completed: false
            }

        ],
        files: [

            {
                id: "atom-ui",

                type: "FIG",

                name: "Atom UI Design.fig",

                date: "02 Aug 2026",

                description: "Main application interface design",
                notes: `
Design Notes:

• Dark premium desktop theme
• Rounded cards
• Fixed navigation rail
• Independent scrolling panels

Next:
Improve animations and transitions.
`
            },


            {
                id: "renderer",

                type: "TS",

                name: "renderer.ts",

                date: "02 Aug 2026",

                description: "Main renderer logic",
                notes: `
Design Notes:

• Dark premium desktop theme
• Rounded cards
• Fixed navigation rail
• Independent scrolling panels

Next:
Improve animations and transitions.
`
            }

        ]


    },


    {


        id: 2,

        name: "Portfolio Website",

        date: "28 July 2026",

        description:
            "Personal design portfolio showcasing UI UX projects.",


        progress: 30,


        checklist: [

            {
                title: "Wireframes",
                completed: true
            },

            {
                title: "Development",
                completed: false
            }

        ],
        files: [

            {
                id: "atom-ui",

                type: "FIG",

                name: "Atom UI Design.fig",

                date: "02 Aug 2026",

                description: "Main application interface design",
                notes: `
Design Notes:

• Dark premium desktop theme
• Rounded cards
• Fixed navigation rail
• Independent scrolling panels

Next:
Improve animations and transitions.
`
            },


            {
                id: "renderer",

                type: "TS",

                name: "renderer.ts",

                date: "02 Aug 2026",

                description: "Main renderer logic",
                notes: `
Design Notes:

• Dark premium desktop theme
• Rounded cards
• Fixed navigation rail
• Independent scrolling panels

Next:
Improve animations and transitions.
`
            }

        ]

    }

];