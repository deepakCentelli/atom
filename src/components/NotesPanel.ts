import { ProjectFile } from "../data/projects";


export function NotesPanel(
    file: ProjectFile | undefined
) {


    if (!file) {

        return `

<div class="empty-state">
Select a file to view notes
</div>

`;

    }



    return `


<div class="notes-title">

${file.name}

</div>



<div class="notes-text">

${file.notes.replace(/\n/g, "<br>")}

</div>


`;

}