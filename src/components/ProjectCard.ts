import { Project } from "../data/projects";
import folderIcon from "../icons/folder.svg";

export function ProjectCard(
    project: Project,
    selected: boolean
) {
    return `
<div 
class="project-card ${selected ? "selected" : ""}"
data-id="${project.id}"
>

<div class="project-card-header">

<div>
<h3>
<img class="project-card-folder-icon" src="${folderIcon}" alt="" />
${project.name}
</h3>
<span>
${project.date}
</span>
</div>

<div class="project-more-actions">
<button class="project-card-button project-more-button" type="button" title="Project options" aria-label="Project options" aria-expanded="false">
<span aria-hidden="true">⋮</span>
</button>
<div class="project-action-menu" role="menu">
<button class="project-menu-item project-open-explorer-button" type="button" role="menuitem"><span class="project-menu-icon" aria-hidden="true">*</span>Open in Explorer</button>
<button class="project-menu-item project-copy-path-button" type="button" role="menuitem"><span class="project-menu-icon" aria-hidden="true">*</span>copy project path</button>
<button class="project-menu-item project-edit-button" type="button" role="menuitem"><span class="project-menu-icon" aria-hidden="true">*</span>Edit Project</button>
</div>
</div>

</div>

<p>
${project.description}
</p>

${selected
    ? `
<div class="project-details">

<div class="progress-text">
${project.progress}% Progress
</div>

<div class="progress-bar">
<div 
class="progress-fill"
style="width:${project.progress}%">
</div>
</div>

<div class="checklist">
${project.checklist.map(item => `
<div class="check-item">
<span>
${item.completed ? "✓" : "○"}
</span>
${item.title}
</div>
`).join("")}
</div>

</div>
`
    : ""
}

<div class="expand-icon">
${selected ? "▲" : "▼"}
</div>

</div>
`;
}
