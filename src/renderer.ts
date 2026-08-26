import './index.css';

import projectTypeGraphicsIcon from "./icons/project_type_graphics.svg";
import projectTypeDocumentIcon from "./icons/project_type_document.svg";
import projectTypeCodeIcon from "./icons/project_type_code.svg";
import projectTypePresentationIcon from "./icons/project_type_ppt.svg";
import projectTypeVideoIcon from "./icons/project_type_video.svg";
import projectTypeImageIcon from "./icons/project_type_image.svg";
import projectTypeDefaultIcon from "./icons/project_type_default.svg";
import openPathIcon from "./icons/open_path.svg";
import copyPathIcon from "./icons/copy_path.svg";
import editProjectIcon from "./icons/edit_project.svg";
import pdfIcon from "./icons/appIcons/pdf.svg";
import photoshopIcon from "./icons/appIcons/photoshop.svg";
import illustratorIcon from "./icons/appIcons/illustrator.svg";
import svgIcon from "./icons/appIcons/svg.svg";
import wordIcon from "./icons/appIcons/word.svg";
import excelIcon from "./icons/appIcons/excel.svg";
import powerpointIcon from "./icons/appIcons/powerpoint.svg";
import htmlIcon from "./icons/appIcons/html.svg";
import imagesIcon from "./icons/appIcons/images.svg";
import videoIcon from "./icons/appIcons/video.svg";
import textIcon from "./icons/appIcons/text.svg";
import xdIcon from "./icons/appIcons/xd.svg";
import premierProIcon from "./icons/appIcons/premierpro.svg";
import affinityIcon from "./icons/appIcons/affinity.svg";
import indesignIcon from "./icons/appIcons/indesign.svg";
import userIcon from "./icons/user.svg";
import labelIcon from "./icons/label.svg";
import renameIcon from "./icons/rename.svg";
import duplicateIcon from "./icons/duplicate 1.svg";
import deleteIcon from "./icons/delete.svg";
import openFileIcon from "./icons/openFile.svg";
import shareIcon from "./icons/share.svg";


// ==========================
// DOM
// ==========================

const projectList =
    document.querySelector(".project-list");

const projectTitle =
    document.querySelector(".project-header h1");

const projectDescription =
    document.querySelector(".project-header p");

const fileList =
    document.querySelector(".file-list");

const fileViewControls =
    document.querySelector(".file-view-controls") as HTMLElement | null;

const notesContent =
    document.querySelector(".notes-content");

const projectDate =
    document.querySelector(".project-date");

const projectTagsHeader =
    document.querySelector(".project-tags-header");

const yearSelect =
    document.querySelector("#year-select") as HTMLSelectElement;

const closeProjectTagPickers = () => {
    if (!projectTagsHeader) return;
    projectTagsHeader.querySelectorAll<HTMLElement>(".tag-picker").forEach(picker => {
        picker.classList.remove("visible");
    });
};

const handleProjectTagDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!projectTagsHeader || !projectTagsHeader.contains(target)) {
        closeProjectTagPickers();
    }
};

let projectTagDocumentHandlerAttached = false;

const monthSelect =
    document.querySelector("#month-select") as HTMLSelectElement;

const createProjectButton =
    document.querySelector("#create-project") as HTMLButtonElement | null;

const createNoteButton =
    document.querySelector("#create-note-button") as HTMLButtonElement | null;

const settingsButton =
    document.querySelector(".settings-button");

if (createNoteButton) {
    createNoteButton.disabled = true;
}

const panelTitle =
    document.querySelector("#panel-title");

const dateSelector =
    document.querySelector(".date-selector") as HTMLElement;

const fileSectionTitle =
    document.querySelector(".file-section .section-title");

const notesPanelTitle =
    document.querySelector(".notes-panel .section-title");

const navigationItems =
    document.querySelectorAll<HTMLButtonElement>(".nav-item");

const dashboardView = document.querySelector("#dashboard-view") as HTMLElement;

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];


// ==========================
// STATE
// ==========================

let selectedProjectName: string | null = null;
let selectedProject: RealProject | null = null;
let currentProjects: RealProject[] = [];
let currentFolderPath = "";

let activeView: "projects" | "labels" | "people" | "dashboard" | "pinned" | "recurring" =
    "projects";

function getProjectLocation(projectOrName?: RealProject | string | null): { year: string; month: string; name: string; path: string } {
    let proj: RealProject | undefined;
    if (projectOrName && typeof projectOrName === "object") {
        proj = projectOrName;
    } else if (typeof projectOrName === "string") {
        proj = currentProjects.find(p => p.name === projectOrName || p.path === projectOrName)
            || (selectedProject?.name === projectOrName || selectedProject?.path === projectOrName ? selectedProject : undefined);
    } else {
        proj = selectedProject || undefined;
    }

    if (proj) {
        const normalized = proj.path.replace(/\\/g, "/");
        const segments = normalized.split("/").filter(Boolean);
        const name = proj.name || (segments.length > 0 ? segments[segments.length - 1] : "");
        const month = segments.length >= 2 ? segments[segments.length - 2] : (monthSelect?.value || "");
        const year = segments.length >= 3 ? segments[segments.length - 3] : (yearSelect?.value || "");
        return { year, month, name, path: proj.path };
    }

    const name = typeof projectOrName === "string" ? projectOrName : (selectedProjectName || "");
    const year = yearSelect?.value || "";
    const month = monthSelect?.value || "";
    return { year, month, name, path: "" };
}

let currentNotes: NoteRecord[] = [];
let openNoteEditorTimeout: number | null = null;
let activeFileActionMenu: HTMLElement | null = null;
let activeProjectActionMenu: HTMLElement | null = null;
const selectedFilePaths = new Set<string>();

async function importDroppedFiles(files: File[]) {
    const projectPath = selectedProject?.path;
    if (!projectPath || files.length === 0) return;

    const api = window.electronAPI as Partial<typeof window.electronAPI>;
    if (typeof api.getDroppedFilePath !== "function" || typeof api.importProjectFiles !== "function") {
        window.alert("Restart Atom to enable dragging files into projects.");
        return;
    }
    const getDroppedFilePath = api.getDroppedFilePath;
    const importProjectFiles = api.importProjectFiles;

    const sourcePaths = files
        .map(file => getDroppedFilePath(file))
        .filter(Boolean);
    if (sourcePaths.length === 0) {
        window.alert("Atom could not read the dropped file path. Please try again after restarting Atom.");
        return;
    }

    try {
        const result = await importProjectFiles(
            projectPath,
            currentFolderPath,
            sourcePaths
        );
        selectedFilePaths.clear();
        await loadProjectContents(selectedProject, currentFolderPath);

        if (result.imported.length === 0 && result.skipped.length > 0) {
            window.alert("No files were added. Files that already exist or are not valid files were skipped.");
        }
    } catch (error) {
        console.error("Importing dropped files failed:", error);
        const reason = error instanceof Error ? error.message : String(error);
        window.alert(`Could not add the dropped files to this project.\n\n${reason}`);
    }
}

function setupFilesPaneDropZone() {
    if (!fileList) return;

    let dragDepth = 0;
    fileList.addEventListener("dragenter", (event: DragEvent) => {
        if (!selectedProject || !event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth += 1;
        fileList.classList.add("drop-active");
    });

    fileList.addEventListener("dragover", (event: DragEvent) => {
        if (!selectedProject || !event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        fileList.classList.add("drop-active");
    });

    fileList.addEventListener("dragleave", (event: DragEvent) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        dragDepth -= 1;
        if (dragDepth <= 0) {
            dragDepth = 0;
            fileList.classList.remove("drop-active");
        }
    });

    fileList.addEventListener("drop", async (event: DragEvent) => {
        if (!selectedProject || !event.dataTransfer?.files.length) return;
        event.preventDefault();
        dragDepth = 0;
        fileList.classList.remove("drop-active");
        await importDroppedFiles(Array.from(event.dataTransfer.files));
    });
}

setupFilesPaneDropZone();

function closeFileActionMenu() {
    const menuButton = activeFileActionMenu?.parentElement?.querySelector<HTMLButtonElement>(".file-more-button");
    menuButton?.setAttribute("aria-expanded", "false");
    activeFileActionMenu?.classList.remove("visible");
    activeFileActionMenu = null;
}

function closeProjectActionMenu() {
    const menuButton = activeProjectActionMenu?.parentElement?.querySelector<HTMLButtonElement>(".project-more-button");
    menuButton?.setAttribute("aria-expanded", "false");
    activeProjectActionMenu?.classList.remove("visible");
    activeProjectActionMenu = null;
}

document.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    if (!target.closest(".file-more-actions")) closeFileActionMenu();
    if (!target.closest(".project-more-actions")) closeProjectActionMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeFileActionMenu();
        closeProjectActionMenu();
    }
});

function setFileView(view: "list" | "grid") {
    fileList?.classList.toggle("grid-view", view === "grid");

    document.querySelectorAll<HTMLButtonElement>(".file-view-button")
        .forEach(button => {
            button.classList.toggle("active", button.dataset.fileView === view);
            button.setAttribute("aria-pressed", String(button.dataset.fileView === view));
        });
}

document.querySelectorAll<HTMLButtonElement>(".file-view-button")
    .forEach(button => {
        button.addEventListener("click", () => {
            const view = button.dataset.fileView as "list" | "grid";
            if (view) setFileView(view);
        });
    });

interface NoteRecord {
    id: string;
    project_id: string;
    content: string;
    created_at: string;
    updated_at: string;
}


// ==========================
// PROJECT TYPE
// ==========================

interface RealProject {
    id: string;
    name: string;
    path: string;
    description: string | null;
    status: ProjectStatus | null;
    project_type: ProjectType;
    deadline: string | null;
    pinned?: number;
    created_at: string;
}

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
    { value: "not-started", label: "Not started" },
    { value: "in-progress", label: "In progress" },
    { value: "on-hold", label: "On hold" },
    { value: "cancelled", label: "Cancelled" },
    { value: "completed", label: "Completed" }
];

const PROJECT_TYPES: { value: ProjectType; label: string; icon: string; color: string }[] = [
    { value: "graphics", label: "Graphics", icon: projectTypeGraphicsIcon, color: "#A855F7" },
    { value: "document", label: "Document", icon: projectTypeDocumentIcon, color: "#3B82F6" },
    { value: "code", label: "Code", icon: projectTypeCodeIcon, color: "#22C55E" },
    { value: "presentation", label: "Presentation", icon: projectTypePresentationIcon, color: "#F97316" },
    { value: "video", label: "Video", icon: projectTypeVideoIcon, color: "#EF4444" },
    { value: "image", label: "Image", icon: projectTypeImageIcon, color: "#EAB308" },
    { value: "default", label: "Default", icon: projectTypeDefaultIcon, color: "#9CA3AF" }
];

const getProjectType = (projectType?: ProjectType | null) =>
    PROJECT_TYPES.find(type => type.value === projectType) ?? PROJECT_TYPES[PROJECT_TYPES.length - 1];

const formatCardDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
};

interface ProjectContent {

    name: string;

    type: "file" | "folder";

}

interface DirectoryItem {

    id: string;

    name: string;

    color: string;

}

interface ProjectTags {

    labelIds: string[];

    personIds: string[];

}

function getFileTypeIcon(
    fileName: string
) {

    const fileNameParts =
        fileName.split(".");

    const type =
        fileNameParts.length > 1 &&
            fileNameParts[fileNameParts.length - 1]
            ? fileNameParts[
                fileNameParts.length - 1
            ].toLowerCase()
            : "file";

    const iconMap: Record<string, string> = {
        pdf: pdfIcon,
        psd: photoshopIcon,
        ai: illustratorIcon,
        svg: svgIcon,
        doc: wordIcon,
        docx: wordIcon,
        ppt: powerpointIcon,
        pptx: powerpointIcon,
        xls: excelIcon,
        xlsx: excelIcon,
        html: htmlIcon,
        htm: htmlIcon,
        png: imagesIcon,
        jpg: imagesIcon,
        jpeg: imagesIcon,
        gif: imagesIcon,
        webp: imagesIcon,
        bmp: imagesIcon,
        tiff: imagesIcon,
        tif: imagesIcon,
        mp4: videoIcon,
        mov: videoIcon,
        avi: videoIcon,
        mkv: videoIcon,
        webm: videoIcon,
        txt: textIcon,
        md: textIcon,
        css: textIcon,
        json: textIcon,
        js: textIcon,
        ts: textIcon,
        tsx: textIcon,
        jsx: textIcon,
        yml: textIcon,
        yaml: textIcon,
        xml: textIcon,
        fig: xdIcon,
        figma: xdIcon,
        aep: premierProIcon,
        prproj: premierProIcon,
        afdesign: affinityIcon,
        afphoto: affinityIcon,
        id: indesignIcon,
        indd: indesignIcon
    };

    const iconSrc = iconMap[type] || textIcon;

    return {
        className: type,
        label: type.toUpperCase(),
        iconSrc
    };

}

function getFileIconMarkup(
    fileName: string
) {

    const icon =
        getFileTypeIcon(fileName);

    return `
        <div class="file-icon ${icon.className}">
            <img src="${icon.iconSrc}" alt="${icon.label}" />
        </div>
    `;

}

function getFolderIconMarkup() {

    return `
        <div class="file-icon folder-icon" aria-label="Folder">
            <span></span>
        </div>
    `;

}

function getUserIconMarkup(color = "#52B6C2", className = "person-icon") {
    const strokeColor = color || "#52B6C2";
    return `<svg class="${className}" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18.9157 21.619C17.2779 19.7899 14.8984 18.6389 12.25 18.6389C9.60161 18.6389 7.22184 19.7899 5.58409 21.619M12.25 23.75C5.89873 23.75 0.75 18.6013 0.75 12.25C0.75 5.89873 5.89873 0.75 12.25 0.75C18.6013 0.75 23.75 5.89873 23.75 12.25C23.75 18.6013 18.6013 23.75 12.25 23.75ZM12.25 14.8056C10.1329 14.8056 8.41667 13.0893 8.41667 10.9722C8.41667 8.85513 10.1329 7.13889 12.25 7.13889C14.3671 7.13889 16.0833 8.85513 16.0833 10.9722C16.0833 13.0893 14.3671 14.8056 12.25 14.8056Z" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function openProjectContent(
    projectName: string,
    relativePath: string
) {

    if (!window.electronAPI.openProjectContent) {
        window.alert(
            "Restart Atom once to enable opening files in their default apps."
        );
        return;
    }

    const loc = getProjectLocation(projectName);

    try {
        await window.electronAPI.openProjectContent(
            loc.year,
            loc.month,
            loc.name,
            relativePath
        );
    } catch (err) {
        console.error("Failed to open project content:", err);

        const reason =
            err instanceof Error
                ? err.message
                : "Unknown error";

        window.alert(
            `Windows could not open this file in its default app.\n\n${reason}\n\nIf no default app is installed for this file type, choose one in Windows first.`
        );
    }

}

function showRenameItemModal(itemName: string, isFolder = false) {
    const loc = getProjectLocation(selectedProject);
    const projectName = loc.name;
    if (!projectName) return;

    const overlay = document.createElement("div");
    overlay.className = "atom-modal-overlay";
    overlay.innerHTML = `
        <div class="atom-modal rename-file-modal" role="dialog" aria-modal="true" aria-labelledby="rename-file-title">
            <div class="atom-modal-header">
                <div>
                    <h2 id="rename-file-title">Rename ${isFolder ? "folder" : "file"}</h2>
                    <p>Choose a new name for this ${isFolder ? "folder" : "file"}.</p>
                </div>
                <button class="atom-modal-close" type="button" aria-label="Close rename dialog">×</button>
            </div>
            <form class="atom-modal-body rename-file-form">
                <div class="form-group">
                    <label for="rename-file-input">${isFolder ? "Folder" : "File"} name</label>
                    <input id="rename-file-input" type="text" autocomplete="off" required />
                </div>
                <div class="form-error" id="rename-file-error" role="alert"></div>
                <div class="atom-modal-footer">
                    <button class="atom-button secondary" type="button" data-close-rename>Cancel</button>
                    <button class="atom-button primary" type="submit">Rename ${isFolder ? "folder" : "file"}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector("#rename-file-input") as HTMLInputElement;
    const form = overlay.querySelector(".rename-file-form") as HTMLFormElement;
    const error = overlay.querySelector("#rename-file-error") as HTMLElement;
    const close = () => overlay.remove();

    input.value = itemName;
    input.focus();
    input.select();

    overlay.querySelectorAll<HTMLElement>(".atom-modal-close, [data-close-rename]")
        .forEach(button => button.addEventListener("click", close));

    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const nextName = input.value.trim();
        if (!nextName) {
            error.textContent = `Enter a ${isFolder ? "folder" : "file"} name to continue.`;
            input.focus();
            return;
        }

        if (nextName === itemName) {
            close();
            return;
        }

        const submitButton = form.querySelector("button[type=submit]") as HTMLButtonElement;
        submitButton.disabled = true;
        error.textContent = "";

        const relativeCurrent = currentFolderPath ? `${currentFolderPath}\\${itemName}` : itemName;
        const relativeNext = currentFolderPath ? `${currentFolderPath}\\${nextName}` : nextName;

        try {
            await window.electronAPI.renameFile(
                loc.year,
                loc.month,
                loc.name,
                relativeCurrent,
                relativeNext
            );
            close();
            await loadProjectContents(loc.name, currentFolderPath);
        } catch (err) {
            console.error(`Rename ${isFolder ? "folder" : "file"} failed:`, err);
            error.textContent = `Could not rename the ${isFolder ? "folder" : "file"}. Check that the name is available.`;
            submitButton.disabled = false;
        }
    });
}

function showRenameFileModal(fileName: string) {
    showRenameItemModal(fileName, false);
}

// ==========================
// LABELS AND PEOPLE VIEWS
// ==========================

function getDirectoryType() {

    return activeView === "labels"
        ? "label"
        : "person";

}

async function loadDirectoryItems() {

    const type =
        getDirectoryType();

    const items =
        await window.electronAPI.getDirectoryItems(type);

    renderDirectoryItems(items);

}

function renderDirectoryItems(
    items: DirectoryItem[]
) {

    if (!projectList) return;

    const isPeople = activeView === "people";
    const itemName = isPeople ? "people" : "labels";

    if (items.length === 0) {
        projectList.innerHTML = `
            <div class="empty-state">No ${itemName} yet</div>
        `;
        return;
    }

    projectList.innerHTML = items.map(item => `
        <button class="directory-item" data-directory-id="${item.id}">
            ${isPeople
                ? getUserIconMarkup(item.color, "directory-user-icon")
                : `<span class="directory-color" style="background: ${item.color}"></span>`
            }
            <span>${item.name}</span>
        </button>
    `).join("");

    projectList.querySelectorAll<HTMLButtonElement>(".directory-item")
        .forEach(element => {
            element.addEventListener("click", () => {
                const item = items.find(
                    entry => entry.id === element.dataset.directoryId
                );

                if (item) showDirectoryItemForm(item);
            });
        });

}

function showDirectoryItemForm(
    item?: DirectoryItem
) {

    if (!fileList || !projectTitle || !projectDescription) return;

    const type =
        getDirectoryType();

    const singularName =
        type === "label" ? "Label" : "Person";

    projectTitle.textContent =
        item ? item.name : `New ${singularName}`;

    projectDescription.textContent =
        item
            ? `Edit this ${singularName.toLowerCase()}.`
            : `Create a new ${singularName.toLowerCase()}.`;

    if (fileSectionTitle) {
        fileSectionTitle.textContent =
            `${singularName} details`;
    }

    if (notesPanelTitle) {
        notesPanelTitle.textContent =
            "About";
    }

    if (notesContent) {
        notesContent.innerHTML = `
            <div class="directory-help">
                Choose a memorable name and colour to keep your ${type === "label" ? "labels" : "people"} easy to identify.
            </div>
        `;
    }

    fileList.innerHTML = `
        <form class="directory-form" id="directory-form">
            <div class="form-group">
                <label for="directory-name">Name</label>
                <input id="directory-name" type="text" autocomplete="off" />
            </div>
            <div class="form-group">
                <label for="directory-color">Colour</label>
                <div class="color-field">
                    <input id="directory-color" type="color" />
                    <span id="directory-color-value"></span>
                </div>
            </div>
            <div id="directory-form-error" class="form-error"></div>
            <div class="directory-form-actions">
                ${item ? `<button type="button" id="delete-directory-item" class="atom-button danger">Delete ${singularName}</button>` : ""}
                <button type="submit" class="atom-button primary">${item ? "Save changes" : `Create ${singularName}`}</button>
            </div>
        </form>
    `;

    const nameInput = fileList.querySelector(
        "#directory-name"
    ) as HTMLInputElement;

    const colorInput = fileList.querySelector(
        "#directory-color"
    ) as HTMLInputElement;

    const colorValue = fileList.querySelector(
        "#directory-color-value"
    ) as HTMLElement;

    nameInput.value = item?.name || "";
    colorInput.value = item?.color || "#52B6C2";
    colorValue.textContent = colorInput.value.toUpperCase();

    colorInput.addEventListener("input", () => {
        colorValue.textContent = colorInput.value.toUpperCase();
    });

    fileList.querySelector("#directory-form")?.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const error = fileList.querySelector(
                "#directory-form-error"
            ) as HTMLElement;

            try {
                const savedItem = item
                    ? await window.electronAPI.updateDirectoryItem(
                        type,
                        { id: item.id, name: nameInput.value, color: colorInput.value }
                    )
                    : await window.electronAPI.createDirectoryItem(
                        type,
                        { name: nameInput.value, color: colorInput.value }
                    );

                await loadDirectoryItems();
                showDirectoryItemForm(savedItem);
            } catch (err) {
                console.error("Failed to save directory item:", err);
                error.textContent = "Enter a name to continue.";
            }
        }
    );

    fileList.querySelector("#delete-directory-item")?.addEventListener(
        "click",
        async () => {
            if (!item || !window.confirm(`Delete ${item.name}?`)) return;

            await window.electronAPI.deleteDirectoryItem(type, item.id);
            await loadDirectoryItems();
            clearDirectoryWorkspace();
        }
    );

    nameInput.focus();

}

function clearDirectoryWorkspace() {

    if (projectTitle) projectTitle.textContent = "Nothing selected";
    if (projectDescription) {
        projectDescription.textContent = "Select an item or create a new one.";
    }
    if (fileSectionTitle) fileSectionTitle.textContent = "Details";
    if (notesPanelTitle) notesPanelTitle.textContent = "About";
    if (fileList) fileList.innerHTML = `<div class="empty-state">No item selected</div>`;
    if (notesContent) notesContent.innerHTML = `<div class="empty-state">Details will appear here</div>`;

}

async function switchView(
    view: "projects" | "labels" | "people" | "dashboard" | "pinned" | "recurring"
) {

    activeView = view;

    navigationItems.forEach(item => {
        item.classList.toggle("active", item.dataset.view === view);
    });

    dashboardView.hidden = view !== "dashboard";
    document.querySelector<HTMLElement>(".project-explorer")!.style.display = view === "dashboard" ? "none" : "flex";
    document.querySelector<HTMLElement>(".workspace")!.style.display = view === "dashboard" ? "none" : "flex";

    if (view !== "dashboard" && attendanceInterval) {
        clearInterval(attendanceInterval);
        attendanceInterval = null;
    }

    if (view === "dashboard") {
        await renderDashboard();
        return;
    }

    if (view === "pinned") {
        if (panelTitle) panelTitle.textContent = "Pinned Projects";
        dateSelector.style.display = "none";
        if (createProjectButton) createProjectButton.style.display = "none";
        if (fileSectionTitle) fileSectionTitle.textContent = "Files";
        if (fileViewControls) fileViewControls.style.display = "flex";
        if (notesPanelTitle) notesPanelTitle.textContent = "Notes";
        await loadPinnedProjects();
        return;
    }

    if (view === "recurring") {
        if (panelTitle) panelTitle.textContent = "Recurring Projects";
        dateSelector.style.display = "none";
        if (createProjectButton) createProjectButton.style.display = "none";
        if (fileSectionTitle) fileSectionTitle.textContent = "Files";
        if (fileViewControls) fileViewControls.style.display = "flex";
        if (notesPanelTitle) notesPanelTitle.textContent = "Notes";
        await loadRecurringProjects();
        return;
    }

    if (view === "projects") {
        if (panelTitle) panelTitle.textContent = "Projects";
        dateSelector.style.display = "flex";
        yearSelect.style.display = "block";
        monthSelect.style.display = "block";
        if (createProjectButton) {
            createProjectButton.textContent = "+";
            createProjectButton.style.display = "block";
        }
        if (fileSectionTitle) fileSectionTitle.textContent = "Files";
        if (fileViewControls) fileViewControls.style.display = "flex";
        if (notesPanelTitle) notesPanelTitle.textContent = "Notes";
        await loadYears();
        return;
    }

    const title = view === "labels" ? "Labels" : "People";
    const singular = view === "labels" ? "Label" : "Person";

    if (panelTitle) panelTitle.textContent = title;
    dateSelector.style.display = "flex";
    yearSelect.style.display = "none";
    monthSelect.style.display = "none";
    if (createProjectButton) {
        createProjectButton.textContent = `+ Create ${singular}`;
        createProjectButton.style.display = "block";
    }
    if (fileViewControls) fileViewControls.style.display = "none";
    clearWorkspace();
    clearDirectoryWorkspace();
    await loadDirectoryItems();

}

function escapeDashboardHtml(value: string) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
}

function dashboardDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
        .format(new Date(value));
}

// ==========================
// ATTENDANCE HELPERS
// ==========================

interface AttendanceSession {
    id: string;
    date: string;
    punch_in: string;
    punch_out: string | null;
    duration_seconds: number;
    created_at?: string;
    updated_at?: string;
}

let attendanceInterval: number | null = null;
let currentAttendanceState: {
    isPunchedIn: boolean;
    activePunchInTime: string | null;
    completedDurationSeconds: number;
    firstPunchInTime: string | null;
    sessionCount: number;
    sessions: AttendanceSession[];
} | null = null;

const TARGET_WORK_SECONDS = 8.5 * 3600; // 8 hours 30 minutes = 30,600 seconds

function formatTimeAmPm(isoString?: string | null): string {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatElapsedHms(totalSeconds: number): string {
    const safeSecs = Math.max(0, Math.floor(totalSeconds));
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatHoursMinutes(totalSeconds: number): string {
    const safeSecs = Math.max(0, Math.floor(totalSeconds));
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
}

function getLiveAttendanceElapsedSeconds(): number {
    if (!currentAttendanceState) return 0;
    let elapsed = currentAttendanceState.completedDurationSeconds || 0;
    if (currentAttendanceState.isPunchedIn && currentAttendanceState.activePunchInTime) {
        const punchInMs = new Date(currentAttendanceState.activePunchInTime).getTime();
        const activeElapsed = Math.max(0, Math.floor((Date.now() - punchInMs) / 1000));
        elapsed += activeElapsed;
    }
    return elapsed;
}

function updateAttendanceLiveDisplay() {
    const timerElem = document.getElementById("attendance-timer-display");
    const progressFill = document.getElementById("attendance-progress-fill");
    const progressPercentElem = document.getElementById("attendance-progress-percent");
    const targetBanner = document.getElementById("attendance-target-banner");
    const statusBadge = document.getElementById("attendance-status-badge");
    const remainingElem = document.getElementById("attendance-remaining-stat");

    if (!timerElem || !currentAttendanceState) return;

    const totalSeconds = getLiveAttendanceElapsedSeconds();
    timerElem.textContent = formatElapsedHms(totalSeconds);

    const progressPercent = Math.min(100, Math.round((totalSeconds / TARGET_WORK_SECONDS) * 1000) / 10);
    const isTargetMet = totalSeconds >= TARGET_WORK_SECONDS;

    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
        progressFill.classList.toggle("target-completed", isTargetMet);
    }

    if (progressPercentElem) {
        progressPercentElem.textContent = `${progressPercent}%`;
    }

    if (remainingElem) {
        if (isTargetMet) {
            remainingElem.textContent = "Goal reached!";
            remainingElem.style.color = "#52bc88";
        } else {
            const leftSecs = TARGET_WORK_SECONDS - totalSeconds;
            remainingElem.textContent = `${formatHoursMinutes(leftSecs)} left`;
            remainingElem.style.color = "#8b92a0";
        }
    }

    if (targetBanner) {
        targetBanner.style.display = isTargetMet ? "flex" : "none";
    }

    if (statusBadge) {
        if (isTargetMet) {
            statusBadge.className = "attendance-status-badge target-met";
            statusBadge.innerHTML = `🎉 Target Met`;
        } else if (currentAttendanceState.isPunchedIn) {
            statusBadge.className = "attendance-status-badge active";
            statusBadge.innerHTML = `<span class="attendance-pulse-dot"></span> Punched In`;
        } else {
            statusBadge.className = "attendance-status-badge inactive";
            statusBadge.innerHTML = `<span class="attendance-idle-dot"></span> Not Working`;
        }
    }
}

async function showMonthlyAttendanceModal(initialYear?: number, initialMonth?: number) {
    const today = new Date();
    let currentYear = initialYear ?? today.getFullYear();
    let currentMonth = initialMonth ?? (today.getMonth() + 1);

    const overlay = document.createElement("div");
    overlay.className = "atom-modal-overlay";

    const renderModalContent = async () => {
        const data = await window.electronAPI.getMonthlyAttendance(currentYear, currentMonth);

        overlay.innerHTML = `
            <div class="atom-modal attendance-monthly-modal" role="dialog" aria-modal="true" aria-labelledby="monthly-attendance-title">
                <div class="atom-modal-header">
                    <div>
                        <h2 id="monthly-attendance-title">Monthly Attendance</h2>
                        <p style="color: #9aa1ad; font-size: 12px; margin-top: 2px;">Working hours and daily breakdown</p>
                    </div>
                    <div class="attendance-month-nav">
                        <button class="attendance-nav-arrow" id="att-prev-month" type="button" title="Previous month">‹</button>
                        <span style="font-weight: 600; font-size: 13px; min-width: 110px; text-align: center;">${data.monthName} ${data.year}</span>
                        <button class="attendance-nav-arrow" id="att-next-month" type="button" title="Next month">›</button>
                    </div>
                    <button class="atom-modal-close" id="close-attendance-modal" type="button" aria-label="Close">×</button>
                </div>
                <div class="atom-modal-body">
                    <div class="attendance-monthly-stats">
                        <div class="attendance-stat-card">
                            <div class="attendance-stat-card-value">${data.daysAttended}</div>
                            <div class="attendance-stat-card-label">Days Attended</div>
                        </div>
                        <div class="attendance-stat-card">
                            <div class="attendance-stat-card-value">${data.totalHoursFormatted}</div>
                            <div class="attendance-stat-card-label">Total Hours</div>
                        </div>
                        <div class="attendance-stat-card">
                            <div class="attendance-stat-card-value">${data.avgHoursPerDayFormatted}</div>
                            <div class="attendance-stat-card-label">Avg Daily</div>
                        </div>
                        <div class="attendance-stat-card">
                            <div class="attendance-stat-card-value" style="color: #52bc88;">${data.targetMetDaysCount}</div>
                            <div class="attendance-stat-card-label">Target Met (8:30)</div>
                        </div>
                    </div>

                    <div class="attendance-history-title">
                        <span>Day-by-Day Activity</span>
                        <span style="font-size: 11px; color: #8b92a0; font-weight: normal;">Target: 8h 30m / day</span>
                    </div>

                    <div class="attendance-table-container">
                        ${data.dailySummaries.length === 0 ? `
                            <div class="dashboard-empty" style="padding: 30px; text-align: center; color: #6b7280; font-size: 13px;">No attendance sessions logged for ${data.monthName} ${data.year}.</div>
                        ` : `
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>First In</th>
                                        <th>Last Out</th>
                                        <th>Duration</th>
                                        <th>8:30 Goal</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.dailySummaries.map(day => `
                                        <tr>
                                            <td style="font-weight: 500; color: #fff;">${escapeDashboardHtml(day.formattedDate)}</td>
                                            <td>${formatTimeAmPm(day.firstPunchIn)}</td>
                                            <td>${day.isActiveToday ? '<span style="color: #52b6c2; font-weight: 600;">Currently In</span>' : formatTimeAmPm(day.lastPunchOut)}</td>
                                            <td style="font-weight: 600; font-variant-numeric: tabular-nums;">${escapeDashboardHtml(day.formattedHours)}</td>
                                            <td style="min-width: 100px;">
                                                <div class="attendance-progress-track" style="height: 6px;">
                                                    <div class="attendance-progress-fill ${day.targetCompleted ? 'target-completed' : ''}" style="width: ${day.progressPercentage}%"></div>
                                                </div>
                                            </td>
                                            <td>
                                                ${day.targetCompleted ? `
                                                    <span class="attendance-pill-badge met">✓ 8:30 Done</span>
                                                ` : day.isActiveToday ? `
                                                    <span class="attendance-pill-badge active">● In Progress</span>
                                                ` : `
                                                    <span class="attendance-pill-badge partial">${day.progressPercentage}%</span>
                                                `}
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            </div>
        `;

        overlay.querySelector("#close-attendance-modal")?.addEventListener("click", () => overlay.remove());
        overlay.querySelector("#att-prev-month")?.addEventListener("click", async () => {
            currentMonth -= 1;
            if (currentMonth < 1) {
                currentMonth = 12;
                currentYear -= 1;
            }
            await renderModalContent();
        });
        overlay.querySelector("#att-next-month")?.addEventListener("click", async () => {
            currentMonth += 1;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear += 1;
            }
            await renderModalContent();
        });
    };

    await renderModalContent();
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

async function renderDashboard() {
    if (attendanceInterval) {
        clearInterval(attendanceInterval);
        attendanceInterval = null;
    }

    dashboardView.innerHTML = `<div class="dashboard-loading">Loading dashboard…</div>`;

    try {
        const [{ projects, notes }, attendanceData] = await Promise.all([
            window.electronAPI.getDashboardData(),
            window.electronAPI.getAttendanceData()
        ]);
        if (activeView !== "dashboard") return;

        currentAttendanceState = {
            isPunchedIn: attendanceData.today.isPunchedIn,
            activePunchInTime: attendanceData.today.activePunchInTime,
            completedDurationSeconds: attendanceData.today.completedDurationSeconds,
            firstPunchInTime: attendanceData.today.firstPunchInTime,
            sessionCount: attendanceData.today.sessionCount,
            sessions: attendanceData.today.sessions,
        };

        const counts = (status: ProjectStatus) => projects.filter(project => project.status === status).length;
        const recentProjects = projects.slice(0, 4);
        const lastProject = projects[0];
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const calendarDays = Array.from({ length: 42 }, (_, index) => {
            const day = new Date(monthStart);
            day.setDate(1 - monthStart.getDay() + index);
            return day;
        });
        const deadlines = new Set(projects.filter(project => project.deadline).map(project => project.deadline));

        const liveTotalSecs = getLiveAttendanceElapsedSeconds();
        const progressPercent = Math.min(100, Math.round((liveTotalSecs / TARGET_WORK_SECONDS) * 1000) / 10);
        const isTargetMet = liveTotalSecs >= TARGET_WORK_SECONDS;

        dashboardView.innerHTML = `
            <header class="dashboard-greeting">
                <h1>Hello, Deepak</h1>
                <p>How’s the day going</p>
            </header>
            <div class="dashboard-grid">
                <div class="dashboard-top-row">
                    <section class="dashboard-panel recent-projects-panel">
                        <div class="dashboard-panel-heading"><h2>Recent Projects</h2><p>Most recent 4 projects</p></div>
                        <div class="dashboard-project-grid">
                            ${recentProjects.map(project => {
                                const files = (project as typeof project & { files?: string[] }).files ?? [];
                                const visibleFiles = files.slice(0, 4);
                                const extraCount = files.length - visibleFiles.length;
                                const fileListHtml = files.length === 0
                                    ? `<div class="dashboard-card-no-files">No files yet</div>`
                                    : `<ul class="dashboard-card-files">
                                        ${visibleFiles.map(name => {
                                            const icon = getFileTypeIcon(name);
                                            return `<li class="dashboard-card-file-item">
                                                <img src="${icon.iconSrc}" alt="${icon.label}" class="dashboard-card-file-icon" />
                                                <span class="dashboard-card-file-name">${escapeDashboardHtml(name)}</span>
                                            </li>`;
                                        }).join("")}
                                        ${extraCount > 0 ? `<li class="dashboard-card-file-more">+${extraCount} more</li>` : ""}
                                    </ul>`;
                                return `<article class="dashboard-project-card">
                                    <span class="dashboard-status-dot status-${project.status ?? "not-started"}"></span>
                                    <span class="dashboard-card-date">${formatCardDate(project.created_at || project.updated_at)}</span>
                                    <h3>${escapeDashboardHtml(project.name)}</h3>
                                    ${fileListHtml}
                                    <div class="dashboard-card-footer">
                                        <span class="dashboard-status-name-inline">${PROJECT_STATUSES.find(item => item.value === project.status)?.label ?? "Not started"}</span>
                                        <button class="dashboard-open-project" data-dashboard-project-id="${project.id}" type="button">Open →</button>
                                    </div>
                                </article>`;
                            }).join("") || `<div class="dashboard-empty">Create a project to see it here.</div>`}
                        </div>
                    </section>

                    <section class="dashboard-panel attendance-panel">
                        <div class="attendance-panel-heading">
                            <div>
                                <h2>Attendance</h2>
                                <p>Daily working tracker</p>
                            </div>
                            <span id="attendance-status-badge" class="attendance-status-badge ${isTargetMet ? 'target-met' : currentAttendanceState.isPunchedIn ? 'active' : 'inactive'}">
                                ${isTargetMet ? '🎉 Target Met' : currentAttendanceState.isPunchedIn ? '<span class="attendance-pulse-dot"></span> Punched In' : '<span class="attendance-idle-dot"></span> Not Working'}
                            </span>
                        </div>

                        <div class="attendance-main-card">
                            <div class="attendance-timer-row">
                                <div class="attendance-timer-info">
                                    <span class="attendance-timer-label">Today's Time</span>
                                    <div class="attendance-timer-display" id="attendance-timer-display">${formatElapsedHms(liveTotalSecs)}</div>
                                </div>
                                <button class="attendance-punch-btn ${currentAttendanceState.isPunchedIn ? 'punch-out' : 'punch-in'}" id="attendance-punch-btn" type="button">
                                    ${currentAttendanceState.isPunchedIn ? 'Punch Out' : 'Punch In'}
                                </button>
                            </div>

                            <div class="attendance-target-section">
                                <div class="attendance-target-header">
                                    <span class="attendance-target-title">Daily Target: <strong>8h 30m</strong></span>
                                    <span class="attendance-target-stat" id="attendance-progress-percent">${progressPercent}%</span>
                                </div>
                                <div class="attendance-progress-track">
                                    <div class="attendance-progress-fill ${isTargetMet ? 'target-completed' : ''}" id="attendance-progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                                <div class="attendance-target-banner" id="attendance-target-banner" style="display: ${isTargetMet ? 'flex' : 'none'};">
                                    ✓ 8:30:00 Daily Target Completed!
                                </div>
                                <div class="attendance-meta-row">
                                    <span>${currentAttendanceState.firstPunchInTime ? `In at ${formatTimeAmPm(currentAttendanceState.firstPunchInTime)}` : 'Not started yet'}</span>
                                    <span id="attendance-remaining-stat" style="${isTargetMet ? 'color: #52bc88;' : ''}">${isTargetMet ? 'Goal reached!' : `${formatHoursMinutes(TARGET_WORK_SECONDS - liveTotalSecs)} left`}</span>
                                </div>
                            </div>
                        </div>

                        <div class="attendance-panel-footer">
                            <span class="attendance-month-stat">
                                Month: <strong id="attendance-month-days">${attendanceData.monthly.daysAttended}</strong> days (${attendanceData.monthly.totalHoursFormatted})
                            </span>
                            <button class="attendance-monthly-btn" id="attendance-monthly-btn" type="button">
                                Monthly Overview →
                            </button>
                        </div>
                    </section>
                </div>

                <section class="dashboard-panel calendar-panel">
                    <div class="dashboard-panel-heading"><h2>${today.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2><p>Project deadlines</p></div>
                    <div class="dashboard-calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}</div>
                    <div class="dashboard-calendar-days">${calendarDays.map(day => { const iso = day.toISOString().slice(0, 10); return `<span class="${day.getMonth() !== today.getMonth() ? "outside-month " : ""}${iso === today.toISOString().slice(0, 10) ? "today " : ""}${deadlines.has(iso) ? "has-deadline" : ""}">${day.getDate()}</span>`; }).join("")}</div>
                </section>
                <section class="dashboard-panel status-summary-panel">
                    ${[["in-progress", "In Progress"], ["on-hold", "On Hold"], ["completed", "Completed"], ["cancelled", "Cancelled"]].map(([status, label]) => `<div><strong>${String(counts(status as ProjectStatus)).padStart(2, "0")}</strong><span>${label}</span></div>`).join("")}
                </section>
                <section class="dashboard-panel last-worked-panel">
                    <div class="dashboard-panel-heading"><h2>Last Opened / Worked</h2></div>
                    ${lastProject ? `<article><div><h3>${escapeDashboardHtml(lastProject.name)}</h3><p>${escapeDashboardHtml(lastProject.description || "No project description")}</p></div><button class="dashboard-open-project" data-dashboard-project-id="${lastProject.id}" type="button">Open project</button></article>` : `<div class="dashboard-empty">No projects yet.</div>`}
                </section>
                <section class="dashboard-panel recent-notes-panel">
                    <div class="dashboard-panel-heading"><h2>Recent Notes</h2></div>
                    <div class="dashboard-notes-grid">
                        ${notes.map(note => { const plainText = extractPlainText(note.content).trim() || "Untitled note"; const [title, ...body] = plainText.split(/\n/); const project = projects.find(item => item.id === note.project_id); return `<article class="dashboard-note-card"><div><span>${escapeDashboardHtml(note.project_name)}</span><time>${dashboardDate(note.updated_at)}</time></div><h3>${escapeDashboardHtml(title)}</h3><p>${escapeDashboardHtml(body.join(" ") || "No additional note content")}</p>${project ? `<button class="dashboard-open-project" data-dashboard-project-id="${project.id}" type="button">Open project</button>` : ""}</article>`; }).join("") || `<div class="dashboard-empty">No notes yet.</div>`}
                    </div>
                </section>
            </div>`;

        // Start live accurate ticking
        attendanceInterval = window.setInterval(() => {
            if (activeView === "dashboard") {
                updateAttendanceLiveDisplay();
            }
        }, 500);

        // Punch button listener
        const punchBtn = document.getElementById("attendance-punch-btn") as HTMLButtonElement | null;
        punchBtn?.addEventListener("click", async () => {
            punchBtn.disabled = true;
            try {
                if (currentAttendanceState?.isPunchedIn) {
                    const updated = await window.electronAPI.punchOut();
                    currentAttendanceState = {
                        isPunchedIn: updated.isPunchedIn,
                        activePunchInTime: updated.activePunchInTime,
                        completedDurationSeconds: updated.completedDurationSeconds,
                        firstPunchInTime: updated.firstPunchInTime,
                        sessionCount: updated.sessionCount,
                        sessions: updated.sessions,
                    };
                    punchBtn.textContent = "Punch In";
                    punchBtn.className = "attendance-punch-btn punch-in";
                } else {
                    const updated = await window.electronAPI.punchIn();
                    currentAttendanceState = {
                        isPunchedIn: updated.isPunchedIn,
                        activePunchInTime: updated.activePunchInTime,
                        completedDurationSeconds: updated.completedDurationSeconds,
                        firstPunchInTime: updated.firstPunchInTime,
                        sessionCount: updated.sessionCount,
                        sessions: updated.sessions,
                    };
                    punchBtn.textContent = "Punch Out";
                    punchBtn.className = "attendance-punch-btn punch-out";
                }
                updateAttendanceLiveDisplay();
            } catch (err) {
                console.error("Attendance action error:", err);
            } finally {
                punchBtn.disabled = false;
            }
        });

        // Monthly overview button listener
        document.getElementById("attendance-monthly-btn")?.addEventListener("click", () => {
            showMonthlyAttendanceModal();
        });

        dashboardView.querySelectorAll<HTMLButtonElement>(".dashboard-open-project").forEach(button => {
            button.addEventListener("click", async () => {
                const project = projects.find(item => item.id === button.dataset.dashboardProjectId);
                if (!project) return;
                const [year, month] = project.path.split(/[\\/]/).slice(-3, -1);
                await switchView("projects");
                yearSelect.value = year;
                await loadMonths(year);
                monthSelect.value = month;
                await loadProjects(year, month);
                selectedProjectName = project.name;
                updateProjectWorkspace(project.name);
            });
        });
    } catch (error) {
        console.error("Failed to load dashboard:", error);
        dashboardView.innerHTML = `<div class="dashboard-empty">The dashboard could not be loaded.</div>`;
    }
}


// ==========================
// LOAD YEARS
// ==========================

function getDefaultYear(years: string[]) {
    const currentYear = String(new Date().getFullYear());

    if (years.includes(currentYear)) {
        return currentYear;
    }

    return years[0] || "";
}

function getDefaultMonth(months: string[], year: string) {
    const currentYear = String(new Date().getFullYear());
    const currentMonth = MONTH_NAMES[new Date().getMonth()];

    if (year === currentYear && months.includes(currentMonth)) {
        return currentMonth;
    }

    return months[0] || "";
}

function getMonthDateRange(yearStr: string, monthStr: string): { minDate: string; maxDate: string } {
    let year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1900) {
        year = new Date().getFullYear();
    }

    let monthIndex = -1;
    const lowerMonth = (monthStr || "").toLowerCase();
    monthIndex = MONTH_NAMES.findIndex(m => lowerMonth.includes(m.toLowerCase()));

    if (monthIndex === -1) {
        const numMatch = (monthStr || "").match(/\b(0?[1-9]|1[0-2])\b/);
        if (numMatch) {
            monthIndex = parseInt(numMatch[1], 10) - 1;
        }
    }

    if (monthIndex < 0 || monthIndex > 11) {
        monthIndex = new Date().getMonth();
    }

    const monthPadded = String(monthIndex + 1).padStart(2, "0");
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const lastDayPadded = String(lastDay).padStart(2, "0");

    return {
        minDate: `${year}-${monthPadded}-01`,
        maxDate: `${year}-${monthPadded}-${lastDayPadded}`
    };
}

async function loadYears() {

    const years =
        await window.electronAPI.getProjectYears();

    if (activeView !== "projects") return;

    yearSelect.innerHTML = "";

    if (years.length === 0) {
        yearSelect.innerHTML =
            `<option value="">No years</option>`;
        monthSelect.innerHTML =
            `<option value="">No months</option>`;
        renderProjects([]);
        return;
    }

    years.forEach(year => {
        const option =
            document.createElement("option");

        option.value = year;
        option.textContent = year;

        yearSelect.appendChild(option);
    });

    const selectedYear = getDefaultYear(years);
    yearSelect.value = selectedYear;

    await loadMonths(selectedYear);

}


// ==========================
// LOAD MONTHS
// ==========================

async function loadMonths(
    year: string
) {

    const months =
        await window.electronAPI.getProjectMonths(year);

    if (activeView !== "projects") return;

    monthSelect.innerHTML = "";

    if (months.length === 0) {
        monthSelect.innerHTML =
            `<option value="">No months</option>`;
        renderProjects([]);
        return;
    }

    months.forEach(month => {
        const option =
            document.createElement("option");

        option.value = month;
        option.textContent = month;

        monthSelect.appendChild(option);
    });

    const selectedMonth = getDefaultMonth(months, year);
    monthSelect.value = selectedMonth;

    await loadProjects(
        year,
        selectedMonth
    );

}


// ==========================
// LOAD PROJECTS
// ==========================

async function loadProjects(
    year: string,
    month: string
) {

    if (!year || !month) {
        renderProjects([]);
        return;
    }

    try {
        const projects =
            await window.electronAPI.getProjects(
                year,
                month
            );

        if (activeView !== "projects") return;

        renderProjects(projects);
    } catch (error) {
        console.error("Failed to load projects:", error);
        if (activeView === "projects") {
            renderProjects([]);
        }
    }

}


// ==========================
// LOAD PINNED PROJECTS
// ==========================

async function loadPinnedProjects() {
    try {
        const projects = await window.electronAPI.getPinnedProjects();
        if (activeView !== "pinned") return;
        renderProjects(projects as RealProject[]);
        if (projects.length === 0) {
            if (projectList) {
                projectList.innerHTML = `<div class="empty-state">No pinned projects yet.<br>Use the ★ Pin Project option in a project's menu to pin it.</div>`;
            }
            clearWorkspace();
        }
    } catch (error) {
        console.error("Failed to load pinned projects:", error);
        if (activeView === "pinned") renderProjects([]);
    }
}


// ==========================
// LOAD RECURRING PROJECTS
// ==========================

async function loadRecurringProjects() {
    try {
        const projects = await window.electronAPI.getRecurringProjects();
        if (activeView !== "recurring") return;
        renderProjects(projects as RealProject[]);
        if (projects.length === 0) {
            if (projectList) {
                projectList.innerHTML = `<div class="empty-state">No recurring projects yet.<br>Create a folder in <strong>Recurring Projects</strong> inside your projects root to see it here.</div>`;
            }
            clearWorkspace();
        }
    } catch (error) {
        console.error("Failed to load recurring projects:", error);
        if (activeView === "recurring") renderProjects([]);
    }
}


// ==========================
// RENDER PROJECTS
// ==========================

async function showProjectOptions(
    projectName: string,
    projectPath?: string
) {
    let project: RealProject | undefined = currentProjects.find(
        p => (projectPath && p.path === projectPath) || p.name === projectName
    );

    const loc = getProjectLocation(project || projectPath || projectName);

    const [tags, labels, people] =
        await Promise.all([
            window.electronAPI.getProjectTags(
                loc.year,
                loc.month,
                loc.name
            ),
            window.electronAPI.getDirectoryItems("label"),
            window.electronAPI.getDirectoryItems("person")
        ]);

    if (!project) {
        const allPinned = await window.electronAPI.getPinnedProjects().catch(() => []);
        project = allPinned.find((p: RealProject) => (projectPath && p.path === projectPath) || p.name === projectName)
            || (await window.electronAPI.getProjects(loc.year, loc.month).then((list: RealProject[]) => list.find(p => p.name === loc.name)).catch(() => undefined));
    }

    if (!project) return;

    const overlay =
        document.createElement("div");

    overlay.className =
        "atom-modal-overlay";

    const renderTagSection = (
        type: "label" | "person",
        title: string,
        items: DirectoryItem[],
        assignedIds: string[]
    ) => {
        const assigned = items.filter(item =>
            assignedIds.includes(item.id)
        );

        const available = items.filter(item => !assignedIds.includes(item.id));

        return `
            <div class="project-options-section">
                <div class="project-options-section-row">
                    <span class="project-options-label">${title}</span>
                    <button class="project-option-add-button" type="button" data-picker-type="${type}">+ Add</button>
                </div>
                <div class="project-options-tags">
                    ${assigned.map(item => `
                        <button
                            class="project-option-tag"
                            data-project-tag-type="${type}"
                            data-project-tag-id="${item.id}"
                            title="Remove ${item.name}"
                        >
                            ${type === "person"
                                ? getUserIconMarkup(item.color, "project-option-user-icon")
                                : `<span style="background: ${item.color}"></span>`
                            }
                            ${item.name} ×
                        </button>
                    `).join("") || `<span class="tag-empty">None assigned</span>`}
                </div>
                <div class="project-option-picker" data-picker-type="${type}">
                    ${available.length === 0
                        ? `<div class="tag-picker-empty">No ${title.toLowerCase()} available</div>`
                        : available.map(item => `
                            <button type="button" class="project-option-picker-option" data-tag-id="${item.id}" data-tag-type="${type}">
                                ${type === "person"
                                    ? getUserIconMarkup(item.color, "project-option-user-icon")
                                    : `<span style="background: ${item.color}"></span>`
                                }
                                ${item.name}
                            </button>
                        `).join("")}
                </div>
            </div>
        `;
    };

    const { minDate, maxDate } = getMonthDateRange(
        loc.year || "",
        loc.month || ""
    );
    const dateInputBounds = activeView === "recurring" ? "" : `min="${minDate}" max="${maxDate}"`;

    let currentCreatedDate = "";
    if (project.created_at) {
        try {
            currentCreatedDate = new Date(project.created_at).toISOString().slice(0, 10);
        } catch {}
    }

    overlay.innerHTML = `
        <div class="atom-modal project-options-modal" role="dialog" aria-modal="true" aria-labelledby="project-options-title">
            <div class="atom-modal-header">
                <div>
                    <h2 id="project-options-title">${project.name}</h2>
                    <p>Manage project details and organization.</p>
                </div>
                <button
                    class="atom-modal-close"
                    id="close-project-options"
                    type="button"
                    aria-label="Close project options"
                >
                    ×
                </button>
            </div>
            <div class="atom-modal-body project-details-form">
                <div class="form-group">
                    <label for="edit-project-description">Project Description</label>
                    <textarea id="edit-project-description" rows="3" placeholder="Add a description for this project..."></textarea>
                </div>

                <div class="project-form-row">
                    <div class="form-group">
                        <label for="edit-project-status">Status</label>
                        <select id="edit-project-status" class="status-${project.status ?? "not-started"}">
                            ${PROJECT_STATUSES.map(status => `<option value="${status.value}" ${status.value === (project.status ?? "not-started") ? "selected" : ""}>${status.label}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-project-type">Project Type</label>
                        <select id="edit-project-type">
                            ${PROJECT_TYPES.map(type => `<option value="${type.value}" ${type.value === (project.project_type ?? "default") ? "selected" : ""}>${type.label}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <div class="project-form-row">
                    <div class="form-group">
                        <label for="edit-project-deadline">Deadline</label>
                        <input id="edit-project-deadline" type="date" value="${project.deadline ?? ""}" />
                    </div>
                    <div class="form-group">
                        <label for="edit-project-created-date">${activeView === "recurring" ? "Date created" : `Date created (within ${loc.month})`}</label>
                        <input id="edit-project-created-date" type="date" value="${currentCreatedDate}" ${dateInputBounds} />
                    </div>
                </div>

                <div class="project-options-save-row">
                    <button id="save-project-details" class="atom-button primary">Save changes</button>
                </div>

                ${renderTagSection("label", "Labels", labels, tags.labelIds)}
                ${renderTagSection("person", "People", people, tags.personIds)}

                <div class="project-options-section rename-section">
                    <span class="project-options-label">Rename Project</span>
                    <div class="rename-project-row">
                        <input id="rename-project-input" type="text" autocomplete="off" />
                        <button id="save-project-rename" class="atom-button secondary">Rename</button>
                    </div>
                </div>

                <div class="project-danger-zone" id="project-danger-zone">
                    <span>Delete this project and all files inside it.</span>
                    <button id="start-project-delete" class="atom-button danger">Delete project</button>
                </div>
                <div class="form-error" id="project-options-error"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const renameInput = overlay.querySelector(
        "#rename-project-input"
    ) as HTMLInputElement;

    renameInput.value = project.name;
    (overlay.querySelector("#edit-project-description") as HTMLTextAreaElement).value = project.description ?? "";

    const closeModal = () => overlay.remove();
    const refreshModal = async () => {
        closeModal();
        await showProjectOptions(loc.name, project?.path);
    };

    overlay.querySelector("#close-project-options")?.addEventListener(
        "click", closeModal
    );

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    const closePickers = () => {
        overlay.querySelectorAll<HTMLDivElement>(".project-option-picker").forEach(picker => {
            picker.classList.remove("visible");
        });
    };

    overlay.addEventListener("click", event => {
        const target = event.target as HTMLElement;
        if (!target.closest(".project-option-picker") && !target.closest(".project-option-add-button")) {
            closePickers();
        }
    });

    const refreshActiveView = async () => {
        if (activeView === "pinned") {
            await loadPinnedProjects();
        } else if (activeView === "recurring") {
            await loadRecurringProjects();
        } else {
            await loadProjects(yearSelect.value, monthSelect.value);
        }
    };

    const saveTags = async (nextTags: ProjectTags) => {
        await window.electronAPI.setProjectTags(
            loc.year,
            loc.month,
            loc.name,
            nextTags
        );
        await refreshModal();
        await loadProjectTags(loc.name);
    };

    overlay.querySelectorAll<HTMLButtonElement>(".project-option-add-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const type = button.dataset.pickerType;
                if (!type) return;

                const picker = overlay.querySelector<HTMLDivElement>(`.project-option-picker[data-picker-type="${type}"]`);
                if (!picker) return;
                picker.classList.toggle("visible");
            });
        });

    overlay.querySelectorAll<HTMLButtonElement>(".project-option-picker-option")
        .forEach(option => {
            option.addEventListener("click", () => {
                const tagId = option.dataset.tagId;
                const isLabel = option.dataset.tagType === "label";
                if (!tagId) return;

                saveTags({
                    labelIds: isLabel
                        ? [...tags.labelIds, tagId]
                        : tags.labelIds,
                    personIds: isLabel
                        ? tags.personIds
                        : [...tags.personIds, tagId]
                });
            });
        });

    overlay.querySelectorAll<HTMLButtonElement>(".project-option-tag")
        .forEach(tag => {
            tag.addEventListener("click", () => {
                const tagId = tag.dataset.projectTagId;
                const isLabel = tag.dataset.projectTagType === "label";

                if (!tagId) return;

                saveTags({
                    labelIds: isLabel
                        ? tags.labelIds.filter(id => id !== tagId)
                        : tags.labelIds,
                    personIds: isLabel
                        ? tags.personIds
                        : tags.personIds.filter(id => id !== tagId)
                });
            });
        });

    overlay.querySelector("#save-project-rename")?.addEventListener(
        "click",
        async () => {
            const error = overlay.querySelector(
                "#project-options-error"
            ) as HTMLElement;

            try {
                const nextName = await window.electronAPI.renameProject(
                    loc.year,
                    loc.month,
                    loc.name,
                    renameInput.value
                );

                closeModal();
                await refreshActiveView();
                selectedProjectName = nextName;
                updateProjectWorkspace(nextName);
            } catch (err) {
                error.textContent = "The project could not be renamed. Choose a different name.";
            }
        }
    );

    overlay.querySelector("#save-project-details")?.addEventListener("click", async () => {
        const error = overlay.querySelector("#project-options-error") as HTMLElement;
        const createdDateInput = overlay.querySelector("#edit-project-created-date") as HTMLInputElement;
        const selectedCreatedDate = createdDateInput?.value;

        const dateChanged = selectedCreatedDate !== currentCreatedDate;
        if (dateChanged && activeView !== "recurring" && selectedCreatedDate && (selectedCreatedDate < minDate || selectedCreatedDate > maxDate)) {
            error.textContent = `Date created must be within ${loc.month} (${minDate} to ${maxDate}).`;
            return;
        }

        try {
            const details: ProjectUpdateDetails = {
                description: (overlay.querySelector("#edit-project-description") as HTMLTextAreaElement).value,
                status: (overlay.querySelector("#edit-project-status") as HTMLSelectElement).value as ProjectStatus,
                project_type: (overlay.querySelector("#edit-project-type") as HTMLSelectElement).value as ProjectType,
                deadline: (overlay.querySelector("#edit-project-deadline") as HTMLInputElement).value
            };

            if (dateChanged) {
                details.created_at = selectedCreatedDate ? new Date(`${selectedCreatedDate}T12:00:00.000Z`).toISOString() : undefined;
            }

            const updated = await window.electronAPI.updateProjectDetails(project.path, details);
            if (updated) {
                selectedProject = updated as RealProject;
                selectedProjectName = updated.name;
                updateProjectWorkspace(updated as RealProject);
            }
            closeModal();
            await refreshActiveView();
        } catch (err) {
            error.textContent = "Project details could not be saved.";
        }
    });

    overlay.querySelector("#start-project-delete")?.addEventListener(
        "click",
        () => {
            const dangerZone = overlay.querySelector(
                "#project-danger-zone"
            ) as HTMLElement;

            dangerZone.innerHTML = `
                <strong>This permanently deletes “${project.name}” and every file inside it.</strong>
                <div class="danger-confirm-actions">
                    <button id="cancel-project-delete" class="atom-button secondary">Cancel</button>
                    <button id="confirm-project-delete" class="atom-button danger">Delete permanently</button>
                </div>
            `;

            dangerZone.querySelector("#cancel-project-delete")?.addEventListener(
                "click",
                () => refreshModal()
            );

            dangerZone.querySelector("#confirm-project-delete")?.addEventListener(
                "click",
                async () => {
                    try {
                        await window.electronAPI.deleteProject(
                            loc.year,
                            loc.month,
                            loc.name
                        );

                        closeModal();
                        await refreshActiveView();
                        clearWorkspace();
                    } catch (err) {
                        console.error("Failed to delete project:", err);
                        dangerZone.insertAdjacentHTML(
                            "beforeend",
                            `<div class="form-error">The project could not be deleted.</div>`
                        );
                    }
                }
            );
        }
    );

}

function renderProjects(
    projects: RealProject[]
) {
    currentProjects = projects;

    if (!projectList)
        return;


    if (projects.length === 0) {

        projectList.innerHTML = `

            <div class="empty-state">

                ${activeView === "pinned" ? "No pinned projects yet.<br>Use the 📌 Pin Project option in a project's menu to pin it." : "No projects in this month"}

            </div>

        `;

        clearWorkspace();

        return;

    }


    projectList.innerHTML =
        projects
            .map(project => {
                const projectType = getProjectType(project.project_type);
                return `

                <div
                    class="project-card ${project.name === selectedProjectName
                    ? "selected"
                    : ""
                }"
                    data-project-name="${project.name}"
                    data-project-path="${project.path}"
                    data-project-deadline="${project.deadline ?? ""}"
                >
                    <div class="project-card-title">
                        <span class="project-card-date">${formatCardDate(project.created_at)}</span>
                        <h3><span class="project-type-icon" style="--project-type-color: ${projectType.color}; --project-type-icon: url('${projectType.icon}')" aria-label="${projectType.label} project"></span><span>${project.name}</span></h3>
                    </div>

                    <div class="project-card-actions">
                        <select class="project-status-select status-${project.status ?? "not-started"}" aria-label="Project status">
                            ${PROJECT_STATUSES.map(status => `<option value="${status.value}" ${status.value === (project.status ?? "not-started") ? "selected" : ""}>${status.label}</option>`).join("")}
                        </select>
                        <div class="project-more-actions">
                            <button class="project-card-button project-more-button" type="button" title="Project options" aria-label="Project options" aria-expanded="false">
                                <span aria-hidden="true">⋮</span>
                            </button>
                            <div class="project-action-menu" role="menu">
                                <button class="project-menu-item project-open-explorer-button" type="button" role="menuitem"><img src="${openPathIcon}" alt="" />Open Path</button>
                                <button class="project-menu-item project-copy-path-button" type="button" role="menuitem"><img src="${copyPathIcon}" alt="" />Copy Path</button>
                                <button class="project-menu-item project-pin-button" type="button" role="menuitem" data-pinned="${project.pinned ? '1' : ''}"><span class="project-menu-icon project-pin-icon" aria-hidden="true">${project.pinned ? '📌' : '📌'}</span>${project.pinned ? 'Unpin Project' : '★ Pin Project'}</button>
                                <button class="project-menu-item project-edit-button" type="button" role="menuitem"><img class="project-edit-menu-icon" src="${editProjectIcon}" alt="" />Edit Project</button>
                            </div>
                        </div>
                    </div>
                </div>

            `;
            })
            .join("");


    addProjectListeners();

}


// ==========================
// PROJECT CLICK
// ==========================

function addProjectListeners() {

    const cards =
        document.querySelectorAll(".project-card");


    cards.forEach(card => {

        card.addEventListener(
            "click",
            () => {

                const name =
                    card.getAttribute(
                        "data-project-name"
                    );
                const path =
                    card.getAttribute(
                        "data-project-path"
                    );


                if (!name)
                    return;


                const proj = currentProjects.find(p => (path && p.path === path) || p.name === name);
                if (proj) {
                    selectedProject = proj;
                    selectedProjectName = proj.name;
                    updateProjectWorkspace(proj);
                } else {
                    selectedProjectName = name;
                    updateProjectWorkspace(name);
                }


                document
                    .querySelectorAll(".project-card")
                    .forEach(otherCard => {

                        otherCard.classList.remove(
                            "selected"
                        );

                    });


                card.classList.add(
                    "selected"
                );

            }
        );

    });

    document.querySelectorAll<HTMLButtonElement>(".project-more-button")
        .forEach(button => {
            const card = button.closest(".project-card");
            const actionMenu = card?.querySelector<HTMLElement>(".project-action-menu");

            button.addEventListener("click", event => {
                event.stopPropagation();
                const willOpen = !actionMenu?.classList.contains("visible");
                closeFileActionMenu();
                closeProjectActionMenu();

                if (willOpen && actionMenu) {
                    actionMenu.classList.add("visible");
                    activeProjectActionMenu = actionMenu;
                }

                button.setAttribute("aria-expanded", String(willOpen));
            });
        });

    document.querySelectorAll<HTMLButtonElement>(".project-open-explorer-button")
        .forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                closeProjectActionMenu();
                const card = button.closest(".project-card");
                const projectPath = card?.getAttribute("data-project-path");
                if (!projectPath) return;

                try {
                    await window.electronAPI.openProjectContent(projectPath, "");
                } catch (err) {
                    console.error("Open in Explorer failed:", err);
                    window.alert("Could not open the project folder in Explorer.");
                }
            });
        });

    document.querySelectorAll<HTMLButtonElement>(".project-copy-path-button")
        .forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                closeProjectActionMenu();
                const card = button.closest(".project-card");
                const projectPath = card?.getAttribute("data-project-path");
                if (!projectPath) return;

                try {
                    const copyProjectPath = (window.electronAPI as Partial<typeof window.electronAPI>).copyProjectPath;
                    if (typeof copyProjectPath === "function") {
                        await copyProjectPath(projectPath);
                    } else if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(projectPath);
                    } else {
                        const copyInput = document.createElement("textarea");
                        copyInput.value = projectPath;
                        copyInput.style.position = "fixed";
                        copyInput.style.opacity = "0";
                        document.body.appendChild(copyInput);
                        copyInput.select();
                        const copied = document.execCommand("copy");
                        copyInput.remove();
                        if (!copied) throw new Error("Clipboard access was unavailable.");
                    }

                    const originalLabel = button.textContent;
                    button.lastChild!.textContent = "Copied Path";
                    window.setTimeout(() => {
                        button.lastChild!.textContent = originalLabel?.trim() || "Copy Path";
                    }, 1200);
                } catch (err) {
                    console.error("Copy project path failed:", err);
                    window.alert("Could not copy the project path.");
                }
            });
        });

    document.querySelectorAll<HTMLButtonElement>(".project-edit-button")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();
                closeProjectActionMenu();
                const card = button.closest(".project-card");
                const projectName = card?.getAttribute("data-project-name");
                const projectPath = card?.getAttribute("data-project-path");
                if (projectName) showProjectOptions(projectName, projectPath || undefined);
            });
        });

    document.querySelectorAll<HTMLButtonElement>(".project-pin-button")
        .forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                closeProjectActionMenu();
                const card = button.closest(".project-card");
                const projectPath = card?.getAttribute("data-project-path");
                if (!projectPath) return;
                try {
                    await window.electronAPI.toggleProjectPinByPath(projectPath);
                    // Refresh whichever list is currently showing
                    if (activeView === "pinned") {
                        await loadPinnedProjects();
                    } else if (activeView === "recurring") {
                        await loadRecurringProjects();
                    } else {
                        await loadProjects(yearSelect.value, monthSelect.value);
                    }
                } catch (err) {
                    console.error("Failed to toggle pin:", err);
                }
            });
        });

    document.querySelectorAll<HTMLSelectElement>(".project-status-select")
        .forEach(select => {
            select.addEventListener("click", event => event.stopPropagation());
            select.addEventListener("change", async event => {
                event.stopPropagation();
                const card = select.closest(".project-card");
                const projectName = card?.getAttribute("data-project-name");
                const projectPath = card?.getAttribute("data-project-path");
                if (!projectName) return;
                const currentStatus = select.value as ProjectStatus;
                const proj = currentProjects.find(p => (projectPath && p.path === projectPath) || p.name === projectName);
                if (!projectPath) return;
                await window.electronAPI.updateProjectDetails(projectPath, {
                    description: proj?.description || "",
                    status: currentStatus,
                    project_type: proj?.project_type ?? "default",
                    deadline: card?.getAttribute("data-project-deadline") ?? (proj?.deadline ?? "")
                });
                selectedProjectName = projectName;
                if (activeView === "pinned") {
                    await loadPinnedProjects();
                } else if (activeView === "recurring") {
                    await loadRecurringProjects();
                } else {
                    await loadProjects(yearSelect.value, monthSelect.value);
                }
            });
        });

}


// ==========================
// CREATE PROJECT MODAL
// ==========================

function showCreateProjectModal() {

    const overlay =
        document.createElement("div");

    overlay.className =
        "atom-modal-overlay";

    const { minDate: newMinDate, maxDate: newMaxDate } = getMonthDateRange(
        yearSelect.value || "",
        monthSelect.value || ""
    );

    const nowIso = new Date().toISOString().slice(0, 10);
    const defaultNewCreatedDate = (nowIso >= newMinDate && nowIso <= newMaxDate) ? nowIso : newMinDate;

    overlay.innerHTML = `
        <div class="atom-modal create-project-modal">
            <div class="atom-modal-header">
                <div>
                    <h2>Create Project</h2>
                    <p>Enter project details to get started</p>
                </div>
                <button
                    class="atom-modal-close"
                    id="close-create-project"
                >
                    ×
                </button>
            </div>

            <div class="atom-modal-body project-details-form">
                <div class="form-group">
                    <label for="project-name-input">Project Name</label>
                    <input
                        id="project-name-input"
                        type="text"
                        placeholder="Enter project name"
                        autocomplete="off"
                    />
                    <div
                        id="create-project-error"
                        class="form-error"
                    ></div>
                </div>

                <div class="form-group">
                    <label for="project-description-input">Project description</label>
                    <textarea id="project-description-input" rows="3" maxlength="500" placeholder="Briefly describe this project"></textarea>
                </div>

                <div class="project-form-row">
                    <div class="form-group">
                        <label for="project-status-input">Status</label>
                        <select id="project-status-input">
                            ${PROJECT_STATUSES.map(status => `<option value="${status.value}">${status.label}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="project-type-input">Project Type</label>
                        <select id="project-type-input">
                            ${PROJECT_TYPES.map(type => `<option value="${type.value}" ${type.value === "default" ? "selected" : ""}>${type.label}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="project-created-date-input">Date created</label>
                        <input id="project-created-date-input" type="date" min="${newMinDate}" max="${newMaxDate}" value="${defaultNewCreatedDate}" />
                    </div>
                </div>

                <div class="project-form-row">
                    <div class="form-group">
                        <label for="project-deadline-input">Deadline</label>
                        <input id="project-deadline-input" type="date" />
                    </div>
                </div>

                <div class="project-location">
                    <span>
                        Location
                    </span>
                    <strong>
                        ${yearSelect.value}
                        /
                        ${monthSelect.value}
                    </strong>
                </div>
            </div>

            <div class="atom-modal-footer">
                <button
                    id="cancel-create-project"
                    class="atom-button secondary"
                >
                    Cancel
                </button>
                <button
                    id="confirm-create-project"
                    class="atom-button primary"
                >
                    Create Project
                </button>
            </div>
        </div>
    `;


    document.body.appendChild(overlay);


    const input =
        overlay.querySelector(
            "#project-name-input"
        ) as HTMLInputElement;


    const error =
        overlay.querySelector(
            "#create-project-error"
        ) as HTMLElement;

    const descriptionInput = overlay.querySelector("#project-description-input") as HTMLTextAreaElement;
    const statusInput = overlay.querySelector("#project-status-input") as HTMLSelectElement;
    const projectTypeInput = overlay.querySelector("#project-type-input") as HTMLSelectElement;
    const deadlineInput = overlay.querySelector("#project-deadline-input") as HTMLInputElement;


    const closeModal = () => {

        overlay.remove();

    };


    overlay
        .querySelector(
            "#close-create-project"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    overlay
        .querySelector(
            "#cancel-create-project"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                closeModal();

            }

        }
    );


    const createButton =
        overlay.querySelector(
            "#confirm-create-project"
        ) as HTMLButtonElement;


    createButton.addEventListener(
        "click",
        async () => {

            const projectName =
                input.value.trim();


            if (!projectName) {

                error.textContent =
                    "Please enter a project name.";

                input.focus();

                return;

            }


            createButton.disabled = true;

            createButton.textContent =
                "Creating...";

            const createdDateInput = overlay.querySelector("#project-created-date-input") as HTMLInputElement;
            const selectedCreatedDate = createdDateInput?.value;

            if (selectedCreatedDate && (selectedCreatedDate < newMinDate || selectedCreatedDate > newMaxDate)) {
                error.textContent = `Date created must be within ${monthSelect.value} (${newMinDate} to ${newMaxDate}).`;
                createButton.disabled = false;
                createButton.textContent = "Create Project";
                return;
            }

            try {

                await window.electronAPI.createProject(

                    yearSelect.value,

                    monthSelect.value,

                    projectName,
                    {
                        description: descriptionInput.value,
                        status: statusInput.value as ProjectStatus,
                        project_type: projectTypeInput.value as ProjectType,
                        deadline: deadlineInput.value,
                        created_at: selectedCreatedDate ? new Date(`${selectedCreatedDate}T12:00:00.000Z`).toISOString() : undefined
                    }

                );


                closeModal();


                await loadProjects(

                    yearSelect.value,

                    monthSelect.value

                );


            } catch (err) {

                console.error(
                    "Failed to create project:",
                    err
                );


                error.textContent =
                    "A project with this name may already exist.";

                createButton.disabled = false;

                createButton.textContent =
                    "Create Project";

            }

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                createButton.click();

            }


            if (
                event.key === "Escape"
            ) {

                closeModal();

            }

        }
    );


    requestAnimationFrame(() => {

        input.focus();

    });

}


// ==========================
// SETTINGS MODAL
// ==========================

async function showSettingsModal() {

    const currentRoot =
        await window.electronAPI.getProjectsRoot();

    const overlay =
        document.createElement("div");

    overlay.className =
        "atom-modal-overlay";

    overlay.innerHTML = `

        <div class="atom-modal">
            <div class="atom-modal-header">
                <div>
                    <h2>Settings</h2>
                    <p>Choose the folder Atom uses to store your projects.</p>
                </div>
                <button class="atom-modal-close" id="close-settings">×</button>
            </div>

            <div class="atom-modal-body">
                <div class="form-group">
                    <label for="projects-root-input">Main projects folder</label>
                    <div class="path-picker">
                        <input id="projects-root-input" type="text" readonly />
                        <button id="browse-projects-root" class="atom-button secondary">Browse…</button>
                    </div>
                    <div id="projects-root-error" class="form-error"></div>
                </div>
            </div>

            <div class="atom-modal-footer">
                <button id="cancel-settings" class="atom-button secondary">Cancel</button>
                <button id="save-settings" class="atom-button primary">Save changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector(
        "#projects-root-input"
    ) as HTMLInputElement;

    input.value = currentRoot;

    const error = overlay.querySelector(
        "#projects-root-error"
    ) as HTMLElement;

    const closeModal = () => overlay.remove();

    overlay.querySelector("#close-settings")?.addEventListener(
        "click", closeModal
    );

    overlay.querySelector("#cancel-settings")?.addEventListener(
        "click", closeModal
    );

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    overlay.querySelector("#browse-projects-root")?.addEventListener(
        "click",
        async () => {
            const selectedRoot =
                await window.electronAPI.chooseProjectsRoot();

            if (selectedRoot) {
                input.value = selectedRoot;
                error.textContent = "";
            }
        }
    );

    const saveButton = overlay.querySelector(
        "#save-settings"
    ) as HTMLButtonElement;

    saveButton.addEventListener("click", async () => {
        if (!input.value) {
            error.textContent = "Choose a projects folder first.";
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            await window.electronAPI.setProjectsRoot(input.value);
            closeModal();
            await loadYears();
        } catch (err) {
            console.error("Failed to update projects folder:", err);
            error.textContent = "That folder could not be used.";
            saveButton.disabled = false;
            saveButton.textContent = "Save changes";
        }
    });

}


// ==========================
// CREATE PROJECT BUTTON
// ==========================

createProjectButton?.addEventListener(
    "click",
    () => {

        if (activeView === "labels" || activeView === "people") {
            showDirectoryItemForm();
            return;
        }

        if (activeView !== "projects") return;

        if (
            !yearSelect.value ||
            !monthSelect.value
        ) {

            return;

        }


        showCreateProjectModal();

    }
);

settingsButton?.addEventListener(
    "click",
    () => {
        showSettingsModal();
    }
);

createNoteButton?.addEventListener(
    "click",
    () => {
        if (!selectedProjectName) {
            window.alert("Select a project before creating a new note.");
            return;
        }

        createOrOpenNewNote();
    }
);

navigationItems.forEach(item => {
    item.addEventListener("click", () => {
        const view = item.dataset.view as
            "projects" | "labels" | "people" | "dashboard" | "pinned" | "recurring";

        if (view) switchView(view);
    });
});


// ==========================
// WORKSPACE
// ==========================

function updateProjectWorkspace(
    projectOrName: RealProject | string
) {
    currentFolderPath = "";
    let project: RealProject | undefined;
    let name = "";

    if (typeof projectOrName === "string") {
        name = projectOrName;
        selectedProjectName = projectOrName;
        project = currentProjects.find(p => p.name === projectOrName || p.path === projectOrName) || (selectedProject?.name === projectOrName ? selectedProject : undefined);
        if (project) {
            selectedProject = project;
        }
    } else {
        project = projectOrName;
        selectedProject = project;
        name = project.name;
        selectedProjectName = project.name;
    }

    if (projectTitle) {
        projectTitle.textContent = name;
    }

    if (projectDescription) {
        projectDescription.textContent = project?.description?.trim() || "No project description";
    }

    if (fileList) {
        fileList.innerHTML = `
            <div class="empty-state">
                Loading files...
            </div>
        `;
    }

    if (notesContent) {
        notesContent.innerHTML = `<div class="empty-state">Loading notes…</div>`;
    }

    if (notesPanelTitle) {
        notesPanelTitle.textContent = "Notes";
    }

    if (projectDate) {
        projectDate.textContent = project?.created_at ? formatCardDate(project.created_at) : formatProjectDate();
    }

    if (projectTagsHeader) {
        projectTagsHeader.innerHTML = "";
    }

    if (createNoteButton) {
        createNoteButton.disabled = false;
    }

    loadProjectContents(project || name);
    loadProjectTags(project || name);
    loadProjectNotes(project || name);
}

// ==========================
// PROJECT TAGS
// ==========================

async function loadProjectTags(
    projectOrName: RealProject | string
) {
    const loc = getProjectLocation(projectOrName);
    if (!loc.name) return;

    const [tags, labels, people] =
        await Promise.all([
            window.electronAPI.getProjectTags(
                loc.year,
                loc.month,
                loc.name
            ),
            window.electronAPI.getDirectoryItems("label"),
            window.electronAPI.getDirectoryItems("person")
        ]);

    if (
        (activeView !== "projects" && activeView !== "pinned" && activeView !== "recurring") ||
        selectedProjectName !== loc.name
    ) return;

    renderProjectTags(
        loc.name,
        tags,
        labels,
        people
    );

}

function formatProjectDate() {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

async function loadProjectNotes(projectOrName: RealProject | string) {
    if (!notesContent) return;

    const loc = getProjectLocation(projectOrName);
    if (!loc.name) return;

    notesContent.innerHTML = `<div class="empty-state">Loading notes…</div>`;

    try {
        currentNotes = await window.electronAPI.getProjectNotes(
            loc.year,
            loc.month,
            loc.name
        );
    } catch (err) {
        console.error("Could not load notes:", err);
        currentNotes = [];
    }

    if (
        (activeView !== "projects" && activeView !== "pinned" && activeView !== "recurring") ||
        selectedProjectName !== loc.name
    ) return;

    renderProjectNotes();
}

function renderProjectNotes() {
    if (!notesContent) return;

    if (currentNotes.length === 0) {
        notesContent.innerHTML = `
            <div class="empty-state">
                No notes yet. Use the button above to add one.
            </div>
        `;
        return;
    }

    notesContent.innerHTML = currentNotes.map(note => `
        <div class="note-card" data-note-id="${note.id}">
            <div class="note-card-header">
                <span>${new Date(note.updated_at).toLocaleString()}</span>
                <div class="note-card-actions">
                    <button class="note-action-button note-edit-button" data-note-id="${note.id}">Edit</button>
                    <button class="note-action-button note-delete-button" data-note-id="${note.id}">Delete</button>
                </div>
            </div>
            <div class="note-card-body">
                ${note.content ? note.content : `<em>Empty note</em>`}
            </div>
        </div>
    `).join("");

    notesContent.querySelectorAll<HTMLButtonElement>(".note-edit-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const noteId = button.dataset.noteId;
                const note = currentNotes.find(item => item.id === noteId);
                if (note) showNoteEditor(note);
            });
        });

    notesContent.querySelectorAll<HTMLButtonElement>(".note-delete-button")
        .forEach(button => {
            button.addEventListener("click", async () => {
                const noteId = button.dataset.noteId;
                if (!noteId || !window.confirm("Delete this note?")) return;
                try {
                    await window.electronAPI.deleteNote(noteId);
                    currentNotes = currentNotes.filter(item => item.id !== noteId);
                    renderProjectNotes();
                } catch (err) {
                    console.error("Could not delete note:", err);
                }
            });
        });

    // Make checkboxes interactive directly in the note card view
    notesContent.querySelectorAll<HTMLInputElement>(".note-checkbox").forEach(checkbox => {
        checkbox.addEventListener("click", async (event) => {
            event.stopPropagation();
            const noteCard = checkbox.closest(".note-card");
            const noteId = noteCard?.getAttribute("data-note-id");
            if (!noteId) return;

            const note = currentNotes.find(item => item.id === noteId);
            if (!note) return;

            if (checkbox.checked) {
                checkbox.setAttribute("checked", "checked");
            } else {
                checkbox.removeAttribute("checked");
            }

            const bodyElem = noteCard.querySelector(".note-card-body");
            if (bodyElem) {
                note.content = bodyElem.innerHTML;
                note.updated_at = new Date().toISOString();
                try {
                    await window.electronAPI.updateNote(note.id, note.content);
                } catch (err) {
                    console.error("Could not update note checkbox:", err);
                }
            }
        });
    });
}

async function createOrOpenNewNote() {
    if (!selectedProjectName) return;
    const loc = getProjectLocation(selectedProject);

    const newNote = await window.electronAPI.createNote(
        loc.year,
        loc.month,
        loc.name,
        ""
    );

    currentNotes.unshift(newNote);
    renderProjectNotes();
    showNoteEditor(newNote);
}

function applyNoteFormat(command: string, value?: string) {
    document.execCommand(command, false, value);
}

function extractPlainText(html: string): string {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
}

function insertCheckboxTask(editor: HTMLElement) {
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    const getTopLevelBlock = (node: Node | null): HTMLElement | null => {
        let curr: Node | null = node;
        while (curr && curr.parentNode !== editor && curr !== editor) {
            curr = curr.parentNode;
        }
        if (curr && curr !== editor && curr.nodeType === Node.ELEMENT_NODE) {
            return curr as HTMLElement;
        }
        return null;
    };

    // If editor is completely empty
    if (!editor.hasChildNodes() || editor.innerHTML.trim() === "" || editor.innerHTML === "<br>") {
        editor.innerHTML = `<div class="note-task-item"><input type="checkbox" class="note-checkbox" /> <span>&nbsp;</span></div>`;
        const span = editor.querySelector("span");
        if (span) {
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        return;
    }

    const startBlock = getTopLevelBlock(range.startContainer);
    const endBlock = getTopLevelBlock(range.endContainer);

    const allChildren = Array.from(editor.children) as HTMLElement[];
    let targetBlocks: HTMLElement[] = [];

    if (startBlock && endBlock) {
        const startIndex = allChildren.indexOf(startBlock);
        const endIndex = allChildren.indexOf(endBlock);
        if (startIndex !== -1 && endIndex !== -1) {
            const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
            targetBlocks = allChildren.slice(from, to + 1);
        }
    } else if (startBlock) {
        targetBlocks = [startBlock];
    } else if (endBlock) {
        targetBlocks = [endBlock];
    }

    // If selection is within a single block or across multiple
    if (targetBlocks.length === 0) {
        let node: Node | null = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const block = node && node !== editor ? (node as HTMLElement).closest("p, div, h1, h2, blockquote") as HTMLElement : null;
        if (block && editor.contains(block)) {
            targetBlocks = [block];
        }
    }

    // If still no block (e.g. direct text in editor)
    if (targetBlocks.length === 0) {
        const selectedText = range.toString();
        const lines = selectedText ? selectedText.split(/\r?\n/) : [""];
        const frag = document.createDocumentFragment();
        let lastSpan: HTMLElement | null = null;

        lines.forEach(lineText => {
            const clean = lineText.trim();
            const taskDiv = document.createElement("div");
            taskDiv.className = "note-task-item";
            taskDiv.innerHTML = `<input type="checkbox" class="note-checkbox" /> <span>${clean ? clean : "&nbsp;"}</span>`;
            frag.appendChild(taskDiv);
            lastSpan = taskDiv.querySelector("span");
        });

        range.deleteContents();
        range.insertNode(frag);

        if (lastSpan) {
            const newRange = document.createRange();
            newRange.selectNodeContents(lastSpan);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        return;
    }

    // Check if ALL target blocks are already task items (then toggle back to paragraphs)
    const allAreTasks = targetBlocks.every(b => b.classList.contains("note-task-item"));

    let lastTargetNode: HTMLElement | null = null;

    targetBlocks.forEach(block => {
        if (allAreTasks) {
            // Convert task back to paragraph
            const span = block.querySelector("span");
            const text = span ? span.textContent?.replace(/\u00a0/g, " ").trim() : block.textContent?.trim() || "";
            const p = document.createElement("p");
            p.innerHTML = text ? text : "<br>";
            block.replaceWith(p);
            lastTargetNode = p;
        } else {
            if (block.classList.contains("note-task-item")) {
                lastTargetNode = block.querySelector("span") || block;
                return;
            }

            const blockHtml = block.innerHTML;
            const innerParts = blockHtml.split(/<br\s*[\/]?>/gi);

            if (innerParts.length > 1 && innerParts.some(p => p.trim())) {
                const frag = document.createDocumentFragment();
                innerParts.forEach(part => {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = part;
                    const text = tempDiv.textContent?.replace(/\u00a0/g, " ").trim() || "";
                    const taskDiv = document.createElement("div");
                    taskDiv.className = "note-task-item";
                    taskDiv.innerHTML = `<input type="checkbox" class="note-checkbox" /> <span>${text ? text : "&nbsp;"}</span>`;
                    frag.appendChild(taskDiv);
                    lastTargetNode = taskDiv.querySelector("span") || taskDiv;
                });
                block.replaceWith(frag);
            } else {
                const text = block.textContent?.replace(/\u00a0/g, " ").trim() || "";
                const taskDiv = document.createElement("div");
                taskDiv.className = "note-task-item";
                taskDiv.innerHTML = `<input type="checkbox" class="note-checkbox" /> <span>${text ? text : "&nbsp;"}</span>`;
                block.replaceWith(taskDiv);
                lastTargetNode = taskDiv.querySelector("span") || taskDiv;
            }
        }
    });

    if (lastTargetNode) {
        const newRange = document.createRange();
        newRange.selectNodeContents(lastTargetNode);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

function showNoteEditor(note: NoteRecord) {
    const overlay = document.createElement("div");
    overlay.className = "atom-modal-overlay";

    overlay.innerHTML = `
        <div class="atom-modal note-editor-modal">
            <div class="atom-modal-header">
                <div>
                    <h2>Edit note</h2>
                    <p>Autosaves while you type.</p>
                </div>
                <button class="atom-modal-close" id="close-note-editor">×</button>
            </div>

            <div class="atom-modal-body">
                <div class="note-editor-toolbar">
                    <button type="button" data-cmd="bold">Bold</button>
                    <button type="button" data-cmd="formatBlock" data-value="h1">H1</button>
                    <button type="button" data-cmd="formatBlock" data-value="h2">H2</button>
                    <button type="button" data-cmd="formatBlock" data-value="p">Body</button>
                    <button type="button" data-cmd="formatBlock" data-value="blockquote">Quote</button>
                    <button type="button" data-cmd="task" id="note-btn-task">☑ Checkbox</button>
                </div>
                <div class="note-editor-body" contenteditable="true" id="note-editor-body"></div>
                <div class="note-editor-status" id="note-editor-status">Saved</div>
            </div>

            <div class="atom-modal-footer note-editor-footer">
                <button id="close-note-editor-footer" class="atom-button secondary">Close</button>
                <button id="delete-note-confirm" class="atom-button danger">Delete note</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const noteBody = overlay.querySelector("#note-editor-body") as HTMLElement;
    const status = overlay.querySelector("#note-editor-status") as HTMLElement;
    const closeButtons = overlay.querySelectorAll("#close-note-editor, #close-note-editor-footer");
    const deleteButton = overlay.querySelector("#delete-note-confirm") as HTMLButtonElement | null;

    noteBody.innerHTML = note.content || "";
    noteBody.focus();

    const saveNoteContent = async () => {
        if (!noteBody) return;
        const content = noteBody.innerHTML;
        try {
            await window.electronAPI.updateNote(note.id, content);
            status.textContent = "Saved";
            note.content = content;
            note.updated_at = new Date().toISOString();
            const index = currentNotes.findIndex(item => item.id === note.id);
            if (index >= 0) {
                currentNotes[index] = note;
                renderProjectNotes();
            }
        } catch (err) {
            console.error("Could not save note:", err);
            status.textContent = "Save failed";
        }
    };

    const scheduleSave = () => {
        if (openNoteEditorTimeout) {
            window.clearTimeout(openNoteEditorTimeout);
        }
        status.textContent = "Saving…";
        openNoteEditorTimeout = window.setTimeout(saveNoteContent, 800);
    };

    noteBody.addEventListener("input", scheduleSave);

    // Toggle checkboxes and keep attribute synchronized
    noteBody.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target && target.classList.contains("note-checkbox")) {
            const checkbox = target as HTMLInputElement;
            if (checkbox.checked) {
                checkbox.setAttribute("checked", "checked");
            } else {
                checkbox.removeAttribute("checked");
            }
            scheduleSave();
        }
    });

    // Enter and Backspace key handling in task items
    noteBody.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            let el: Node | null = range.commonAncestorContainer;
            if (el.nodeType === Node.TEXT_NODE) {
                el = el.parentNode;
            }
            const taskItem = el && el !== noteBody ? (el as HTMLElement).closest(".note-task-item") : null;

            if (taskItem && noteBody.contains(taskItem)) {
                e.preventDefault();
                const span = taskItem.querySelector("span");
                const text = span ? span.textContent?.replace(/\u00a0/g, " ").trim() : "";

                if (!text) {
                    const p = document.createElement("p");
                    p.innerHTML = "<br>";
                    taskItem.replaceWith(p);
                    const newRange = document.createRange();
                    newRange.setStart(p, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else {
                    const newTask = document.createElement("div");
                    newTask.className = "note-task-item";
                    newTask.innerHTML = `<input type="checkbox" class="note-checkbox" /> <span>&nbsp;</span>`;
                    taskItem.after(newTask);

                    const newSpan = newTask.querySelector("span");
                    if (newSpan) {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(newSpan);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
                scheduleSave();
            }
        } else if (e.key === "Backspace") {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            let el: Node | null = range.commonAncestorContainer;
            if (el.nodeType === Node.TEXT_NODE) {
                el = el.parentNode;
            }
            const taskItem = el && el !== noteBody ? (el as HTMLElement).closest(".note-task-item") : null;

            if (taskItem && noteBody.contains(taskItem)) {
                const span = taskItem.querySelector("span");
                const text = span ? span.textContent?.replace(/\u00a0/g, " ").trim() : "";
                if (!text || (range.startOffset === 0 && range.collapsed)) {
                    e.preventDefault();
                    const p = document.createElement("p");
                    p.innerHTML = text ? text : "<br>";
                    taskItem.replaceWith(p);
                    const newRange = document.createRange();
                    newRange.selectNodeContents(p);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    scheduleSave();
                }
            }
        }
    });

    // Typing shortcut: auto-convert "[] " or "[ ] " or "[x] " to a task item
    noteBody.addEventListener("keyup", (e: KeyboardEvent) => {
        if (e.key === " " || e.key === "Spacebar") {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            let el: Node | null = range.commonAncestorContainer;
            if (el.nodeType === Node.TEXT_NODE) {
                const text = el.textContent || "";
                if (/^(\[\]|\[ \]|\[x\]|\[X\])\s$/.test(text) || text.startsWith("[] ") || text.startsWith("[ ] ") || text.startsWith("[x] ") || text.startsWith("[X] ")) {
                    const isChecked = text.startsWith("[x] ") || text.startsWith("[X] ");
                    const parent = el.parentElement;
                    if (parent && parent !== noteBody && !parent.classList.contains("note-task-item")) {
                        const taskDiv = document.createElement("div");
                        taskDiv.className = "note-task-item";
                        taskDiv.innerHTML = `<input type="checkbox" class="note-checkbox" ${isChecked ? 'checked="checked"' : ""} /> <span>&nbsp;</span>`;
                        parent.replaceWith(taskDiv);

                        const span = taskDiv.querySelector("span");
                        if (span) {
                            const newRange = document.createRange();
                            newRange.selectNodeContents(span);
                            newRange.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                        scheduleSave();
                    }
                }
            }
        }
    });

    overlay.querySelectorAll<HTMLButtonElement>(".note-editor-toolbar button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const cmd = button.dataset.cmd;
                const value = button.dataset.value;
                if (!cmd) return;
                if (cmd === "task") {
                    insertCheckboxTask(noteBody);
                    scheduleSave();
                    return;
                }
                applyNoteFormat(cmd, value);
                noteBody.focus();
            });
        });

    closeButtons.forEach(button => {
        button.addEventListener("click", async () => {
            if (openNoteEditorTimeout) {
                window.clearTimeout(openNoteEditorTimeout);
                await saveNoteContent();
            }
            overlay.remove();
        });
    });

    deleteButton?.addEventListener("click", async () => {
        if (!window.confirm("Delete this note permanently?")) return;
        try {
            await window.electronAPI.deleteNote(note.id);
            overlay.remove();
            currentNotes = currentNotes.filter(item => item.id !== note.id);
            renderProjectNotes();
        } catch (err) {
            console.error("Could not delete note:", err);
        }
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            if (openNoteEditorTimeout) {
                window.clearTimeout(openNoteEditorTimeout);
                saveNoteContent();
            }
            overlay.remove();
        }
    });
}

function renderProjectTags(
    projectName: string,
    tags: ProjectTags,
    labels: DirectoryItem[],
    people: DirectoryItem[]
) {
    if (!projectTagsHeader) return;

    const selectedLabels =
        labels.filter(label =>
            tags.labelIds.includes(label.id)
        );

    const selectedPeople =
        people.filter(person =>
            tags.personIds.includes(person.id)
        );

    const renderAddPicker = (
        type: "label" | "person",
        selected: DirectoryItem[],
        allItems: DirectoryItem[]
    ) => {
        const available = allItems.filter(item => !selected.some(selectedItem => selectedItem.id === item.id));

        return `
            <div class="project-tag-group">
                <div class="tag-chips">
                    ${selected.map(item => `
                        <button
                            class="tag-chip"
                            type="button"
                            data-tag-id="${item.id}"
                            data-tag-type="${type}"
                            title="Remove ${item.name}"
                        >
                            ${type === "person"
                                ? getUserIconMarkup(item.color, "tag-chip-user-icon")
                                : `<span class="tag-chip-dot" style="background: ${item.color}"></span>`
                            }
                            ${item.name}
                            <span class="tag-chip-close">×</span>
                        </button>
                    `).join("")}
                    <button class="tag-add-button" type="button" data-picker-type="${type}">+
                    </button>
                </div>
                <div class="tag-picker" data-picker-type="${type}">
                    ${available.length === 0
                        ? `<div class="tag-picker-empty">No ${type === "label" ? "labels" : "people"} available</div>`
                        : available.map(item => `
                            <button type="button" class="tag-picker-option" data-tag-id="${item.id}" data-tag-type="${type}">
                                ${type === "person"
                                    ? getUserIconMarkup(item.color, "tag-picker-user-icon")
                                    : `<span class="tag-picker-dot" style="background: ${item.color}"></span>`
                                }
                                ${item.name}
                            </button>
                        `).join("")
                    }
                </div>
            </div>
        `;
    };

    projectTagsHeader.innerHTML = `
        <div class="project-tags">
            ${renderAddPicker("label", selectedLabels, labels)}
            ${renderAddPicker("person", selectedPeople, people)}
        </div>
    `;

    const saveTags = async (nextTags: ProjectTags) => {
        const loc = getProjectLocation(projectName);
        await window.electronAPI.setProjectTags(
            loc.year,
            loc.month,
            loc.name,
            nextTags
        );
        await loadProjectTags(loc.name);
    };

    const closePickers = () => {
        projectTagsHeader.querySelectorAll<HTMLElement>(".tag-picker").forEach(picker => {
            picker.classList.remove("visible");
        });
    };

    projectTagsHeader.querySelectorAll<HTMLButtonElement>(".tag-add-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const type = button.dataset.pickerType;
                if (!type) return;

                closePickers();
                const picker = projectTagsHeader.querySelector<HTMLElement>(`.tag-picker[data-picker-type="${type}"]`);
                picker?.classList.toggle("visible");
            });
        });

    projectTagsHeader.querySelectorAll<HTMLButtonElement>(".tag-picker-option")
        .forEach(option => {
            option.addEventListener("click", () => {
                const id = option.dataset.tagId;
                const type = option.dataset.tagType as "label" | "person";
                if (!id) return;

                saveTags({
                    labelIds: type === "label" ? [...tags.labelIds, id] : tags.labelIds,
                    personIds: type === "person" ? [...tags.personIds, id] : tags.personIds
                });
                closePickers();
            });
        });

    projectTagsHeader.querySelectorAll<HTMLButtonElement>(".tag-chip")
        .forEach(button => {
            button.addEventListener("click", () => {
                const id = button.dataset.tagId;
                const isLabel = button.dataset.tagType === "label";
                if (!id) return;

                saveTags({
                    labelIds: isLabel
                        ? tags.labelIds.filter(tagId => tagId !== id)
                        : tags.labelIds,
                    personIds: isLabel
                        ? tags.personIds
                        : tags.personIds.filter(personId => personId !== id)
                });
            });
        });

    if (!projectTagDocumentHandlerAttached) {
        document.addEventListener("click", handleProjectTagDocumentClick);
        projectTagDocumentHandlerAttached = true;
    }
}

// ==========================
// BREADCRUMBS
// ==========================

function renderFileBreadcrumbs(projectName: string, folderPath: string) {
    const breadcrumbsElem = document.querySelector("#file-breadcrumbs");
    if (!breadcrumbsElem) return;

    if (!projectName) {
        breadcrumbsElem.innerHTML = "";
        return;
    }

    const segments = folderPath ? folderPath.split(/[\\/]/).filter(Boolean) : [];

    let html = `
        <button class="breadcrumb-item ${segments.length === 0 ? "breadcrumb-current" : ""}" data-folder-path="" type="button">
            ${projectName}
        </button>
    `;

    let accumulatedPath = "";
    segments.forEach((seg, idx) => {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}\\${seg}` : seg;
        const isCurrent = idx === segments.length - 1;
        html += `
            <span class="breadcrumb-separator" aria-hidden="true">></span>
            <button class="breadcrumb-item ${isCurrent ? "breadcrumb-current" : ""}" data-folder-path="${accumulatedPath}" type="button">
                ${seg}
            </button>
        `;
    });

    breadcrumbsElem.innerHTML = html;

    breadcrumbsElem.querySelectorAll<HTMLButtonElement>(".breadcrumb-item").forEach(button => {
        button.addEventListener("click", () => {
            const targetPath = button.getAttribute("data-folder-path") ?? "";
            if (targetPath === currentFolderPath) return;
            currentFolderPath = targetPath;
            loadProjectContents(selectedProject || selectedProjectName || "", currentFolderPath);
        });
    });
}

// ==========================
// LOAD PROJECT CONTENTS
// ==========================

async function loadProjectContents(
    projectOrName: RealProject | string,
    folderPath = currentFolderPath
) {
    currentFolderPath = folderPath;
    selectedFilePaths.clear();
    const loc = getProjectLocation(projectOrName);
    if (!loc.name) {
        renderFileBreadcrumbs("", "");
        return;
    }

    renderFileBreadcrumbs(loc.name, currentFolderPath);

    let contents: ProjectContent[] = [];
    try {
        if (currentFolderPath) {
            contents = loc.path
                ? await window.electronAPI.getProjectFolderContents(loc.path, currentFolderPath)
                : await window.electronAPI.getProjectFolderContents(
                    loc.year,
                    loc.month,
                    loc.name,
                    currentFolderPath
                );
        } else {
            contents = loc.path
                ? await window.electronAPI.getProjectContents(loc.path)
                : await window.electronAPI.getProjectContents(
                    loc.year,
                    loc.month,
                    loc.name
                );
        }
    } catch (err) {
        console.error("Could not load project contents:", err);
        contents = [];
    }

    if (
        (activeView !== "projects" && activeView !== "pinned" && activeView !== "recurring") ||
        selectedProjectName !== loc.name
    ) return;

    if (!fileList)
        return;

    if (contents.length === 0) {
        fileList.innerHTML = `
            <div class="empty-state">
                ${currentFolderPath ? "Empty folder" : "No files or folders"}
            </div>
        `;
        return;
    }

    const files =
        contents.filter(
            item =>
                item.type === "file"
        );

    const folders =
        contents.filter(
            item =>
                item.type === "folder"
        );

    fileList.innerHTML = "";

    // ==========================
    // FOLDERS
    // ==========================

    folders.forEach(folder => {
        const element = document.createElement("div");
        element.className = "file-card folder-card";
        const relativeFolderPath = currentFolderPath ? `${currentFolderPath}\\${folder.name}` : folder.name;

        element.innerHTML = `
            ${getFolderIconMarkup()}

            <div class="file-info">
                <div class="file-name" title="${folder.name}">
                    ${folder.name}
                </div>
            </div>

            <div class="file-more-actions">
                <button class="file-more-button" type="button" title="Folder options" aria-label="Folder options" aria-expanded="false">
                    <span aria-hidden="true">⋮</span>
                </button>
                <div class="file-action-menu" role="menu">
                    <button class="file-menu-item file-open-button" type="button" role="menuitem"><img src="${openFileIcon}" alt="" />Open folder</button>
                    <button class="file-menu-item file-rename-button" type="button" role="menuitem"><img src="${renameIcon}" alt="" />Rename</button>
                    <button class="file-menu-item file-duplicate-button" type="button" role="menuitem"><img src="${duplicateIcon}" alt="" />Duplicate</button>
                    <button class="file-menu-item file-share-button" type="button" role="menuitem"><img src="${shareIcon}" alt="" />Share</button>
                    <button class="file-menu-item file-delete-button danger" type="button" role="menuitem"><img src="${deleteIcon}" alt="" />Delete</button>
                </div>
            </div>
        `;

        fileList.appendChild(element);

        const moreButton = element.querySelector<HTMLButtonElement>(".file-more-button");
        const actionMenu = element.querySelector<HTMLElement>(".file-action-menu");

        const openMenu = () => {
            const willOpen = !actionMenu?.classList.contains("visible");
            closeFileActionMenu();
            closeProjectActionMenu();

            if (willOpen && actionMenu) {
                actionMenu.classList.add("visible");
                activeFileActionMenu = actionMenu;
            }

            moreButton?.setAttribute("aria-expanded", String(willOpen));
        };

        moreButton?.addEventListener("click", event => {
            event.stopPropagation();
            openMenu();
        });

        element.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
            openMenu();
        });

        element.querySelector<HTMLButtonElement>(".file-open-button")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeFileActionMenu();
                currentFolderPath = relativeFolderPath;
                loadProjectContents(selectedProject || loc.name, currentFolderPath);
            }
        );

        element.querySelector<HTMLButtonElement>(".file-rename-button")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeFileActionMenu();
                showRenameItemModal(folder.name, true);
            }
        );

        element.querySelector<HTMLButtonElement>(".file-duplicate-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();
                if (!selectedProjectName) return;
                const curLoc = getProjectLocation(selectedProject);

                try {
                    await window.electronAPI.duplicateFile(
                        curLoc.year,
                        curLoc.month,
                        curLoc.name,
                        relativeFolderPath
                    );
                    await loadProjectContents(curLoc.name, currentFolderPath);
                } catch (err) {
                    console.error("Duplicate folder failed:", err);
                    window.alert("Could not duplicate the folder.");
                }
            }
        );

        element.querySelector<HTMLButtonElement>(".file-share-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();

                try {
                    await navigator.clipboard.writeText(`${selectedProjectName}\\${relativeFolderPath}`);
                } catch (err) {
                    console.error("Copy folder path failed:", err);
                    window.alert("Could not copy the folder path.");
                }
            }
        );

        element.querySelector<HTMLButtonElement>(".file-delete-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();
                if (!selectedProjectName) return;
                if (!window.confirm(`Delete folder "${folder.name}" and all its contents?`)) return;

                const curLoc = getProjectLocation(selectedProject);

                try {
                    await window.electronAPI.deleteFile(
                        curLoc.year,
                        curLoc.month,
                        curLoc.name,
                        relativeFolderPath
                    );
                    await loadProjectContents(curLoc.name, currentFolderPath);
                } catch (err) {
                    console.error("Delete folder failed:", err);
                    window.alert("Could not delete the folder.");
                }
            }
        );

        element.addEventListener("click", event => {
            const target = event.target as HTMLElement;
            if (target.closest(".file-more-actions")) return;
            currentFolderPath = relativeFolderPath;
            loadProjectContents(selectedProject || loc.name, currentFolderPath);
        });
    });

    // ==========================
    // FILES
    // ==========================

    files.forEach(file => {
        const element =
            document.createElement("div");

        element.className =
            "file-card";
        element.draggable = true;

        const relativeFilePath = currentFolderPath ? `${currentFolderPath}\\${file.name}` : file.name;

        element.innerHTML = `
            ${getFileIconMarkup(file.name)}

            <div class="file-info">
                <div class="file-name" title="${file.name}">
                    ${file.name}
                </div>
            </div>

            <div class="file-more-actions">
                <button class="file-more-button" type="button" title="File options" aria-label="File options" aria-expanded="false">
                    <span aria-hidden="true">⋮</span>
                </button>
                <div class="file-action-menu" role="menu">
                    <button class="file-menu-item file-open-button" type="button" role="menuitem"><img src="${openFileIcon}" alt="" />Open file</button>
                    <button class="file-menu-item file-rename-button" type="button" role="menuitem"><img src="${renameIcon}" alt="" />Rename</button>
                    <button class="file-menu-item file-duplicate-button" type="button" role="menuitem"><img src="${duplicateIcon}" alt="" />Duplicate</button>
                    <button class="file-menu-item file-share-button" type="button" role="menuitem"><img src="${shareIcon}" alt="" />Share</button>
                    <button class="file-menu-item file-delete-button danger" type="button" role="menuitem"><img src="${deleteIcon}" alt="" />Delete</button>
                </div>
            </div>
        `;

        fileList.appendChild(element);

        element.addEventListener("click", event => {
            const target = event.target as HTMLElement;
            if (target.closest(".file-more-actions")) return;

            if (event.ctrlKey || event.metaKey) {
                if (selectedFilePaths.has(relativeFilePath)) {
                    selectedFilePaths.delete(relativeFilePath);
                    element.classList.remove("selected");
                } else {
                    selectedFilePaths.add(relativeFilePath);
                    element.classList.add("selected");
                }
                return;
            }

            selectedFilePaths.clear();
            fileList?.querySelectorAll(".file-card:not(.folder-card)").forEach(card => card.classList.remove("selected"));
            selectedFilePaths.add(relativeFilePath);
            element.classList.add("selected");
        });

        element.addEventListener("dragstart", event => {
            const projectPath = selectedProject?.path;
            if (!projectPath) {
                event.preventDefault();
                return;
            }

            // Electron requires cancelling the DOM drag before the main process
            // can hand it off as an OS-level file drag operation.
            event.preventDefault();

            if (!selectedFilePaths.has(relativeFilePath)) {
                selectedFilePaths.clear();
                fileList?.querySelectorAll(".file-card:not(.folder-card)").forEach(card => card.classList.remove("selected"));
                selectedFilePaths.add(relativeFilePath);
                element.classList.add("selected");
            }

            event.dataTransfer?.setData("text/plain", file.name);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
            element.classList.add("is-dragging");
            window.electronAPI.startFileDrag(projectPath, [...selectedFilePaths]);
        });

        element.addEventListener("dragend", () => {
            element.classList.remove("is-dragging");
        });

        const moreButton = element.querySelector<HTMLButtonElement>(".file-more-button");
        const actionMenu = element.querySelector<HTMLElement>(".file-action-menu");

        const openMenu = () => {
            const willOpen = !actionMenu?.classList.contains("visible");
            closeFileActionMenu();
            closeProjectActionMenu();

            if (willOpen && actionMenu) {
                actionMenu.classList.add("visible");
                activeFileActionMenu = actionMenu;
            }

            moreButton?.setAttribute("aria-expanded", String(willOpen));
        };

        moreButton?.addEventListener("click", event => {
            event.stopPropagation();
            openMenu();
        });

        element.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
            openMenu();
        });

        element.querySelector<HTMLButtonElement>(".file-open-button")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeFileActionMenu();
                if (selectedProjectName) openProjectContent(selectedProjectName, relativeFilePath);
            }
        );

        element.querySelector<HTMLButtonElement>(".file-rename-button")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeFileActionMenu();
                showRenameItemModal(file.name, false);
            }
        );

        element.querySelector<HTMLButtonElement>(".file-duplicate-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();
                if (!selectedProjectName) return;

                const curLoc = getProjectLocation(selectedProject);

                try {
                    await window.electronAPI.duplicateFile(
                        curLoc.year,
                        curLoc.month,
                        curLoc.name,
                        relativeFilePath
                    );
                    await loadProjectContents(curLoc.name, currentFolderPath);
                } catch (err) {
                    console.error("Duplicate file failed:", err);
                    window.alert("Could not duplicate the file.");
                }
            }
        );

        element.querySelector<HTMLButtonElement>(".file-share-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();

                try {
                    await navigator.clipboard.writeText(`${selectedProjectName}\\${relativeFilePath}`);
                } catch (err) {
                    console.error("Copy file path failed:", err);
                    window.alert("Could not copy the file path.");
                }
            }
        );

        element.querySelector<HTMLButtonElement>(".file-delete-button")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();
                closeFileActionMenu();
                const fileName = file.name;
                if (!selectedProjectName) return;
                if (!window.confirm(`Delete file "${fileName}"?`)) return;

                const curLoc = getProjectLocation(selectedProject);

                try {
                    await window.electronAPI.deleteFile(
                        curLoc.year,
                        curLoc.month,
                        curLoc.name,
                        relativeFilePath
                    );
                    await loadProjectContents(curLoc.name, currentFolderPath);
                } catch (err) {
                    console.error("Delete file failed:", err);
                    window.alert("Could not delete the file.");
                }
            }
        );

        element.addEventListener(
            "dblclick",
            () => {
                const projectName = selectedProjectName;

                if (projectName) {
                    openProjectContent(
                        projectName,
                        relativeFilePath
                    );
                }
            }
        );
    });
}

// ==========================
// CLEAR WORKSPACE
// ==========================

function clearWorkspace() {
    selectedProject = null;
    selectedProjectName = null;
    currentFolderPath = "";
    renderFileBreadcrumbs("", "");

    if (projectTitle) {
        projectTitle.textContent = "No Project Selected";
    }

    if (projectDescription) {
        projectDescription.textContent = "Select a project to begin.";
    }

    if (fileList) {
        fileList.innerHTML = `
            <div class="empty-state">
                No project selected
            </div>
        `;
    }

    if (notesContent) {
        notesContent.innerHTML = `<div class="empty-state">No project selected</div>`;
    }

    if (notesPanelTitle) {
        notesPanelTitle.textContent = "Notes";
    }

    if (projectDate) {
        projectDate.textContent = "";
    }

    if (projectTagsHeader) {
        projectTagsHeader.innerHTML = "";
    }

    if (createNoteButton) {
        createNoteButton.disabled = true;
    }
}


// ==========================
// YEAR CHANGE
// ==========================

yearSelect?.addEventListener(
    "change",
    async () => {

        await loadMonths(
            yearSelect.value
        );

    }
);


// ==========================
// MONTH CHANGE
// ==========================

monthSelect?.addEventListener(
    "change",
    async () => {

        await loadProjects(
            yearSelect.value,
            monthSelect.value
        );

    }
);


// ==========================
// INITIALIZE
// ==========================

switchView("projects");
