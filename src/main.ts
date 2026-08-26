import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import crypto from "node:crypto";
import fs from "fs/promises";
import started from "electron-squirrel-startup";
import {
  initializeDatabase,
  insertProjectRecord,
  updateProjectPath,
  updateProjectRecord,
  deleteProjectRecordByPath,
  getProjectRecordByPath,
  getAllProjectRecords,
  getPinnedProjectRecords,
  toggleProjectPin,
  getRecentNotes,
  getProjectNotesByPath,
  createNoteRecord,
  updateNoteRecord,
  deleteNoteRecord,
  punchInRecord,
  punchOutRecord,
  getTodayAttendanceSummary,
  getMonthlyAttendanceSummary,
} from "./db";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;


// ==========================
// PROJECTS ROOT
// ==========================

const DEFAULT_PROJECTS_ROOT = "D:\\Projects";

let projectsRoot = DEFAULT_PROJECTS_ROOT;

interface DirectoryItem {
  id: string;
  name: string;
  color: string;
}

interface ProjectTags {
  labelIds: string[];
  personIds: string[];
}

let labels: DirectoryItem[] = [];
let people: DirectoryItem[] = [];
let projectTags: Record<string, ProjectTags> = {};

const getSettingsPath = () =>
  path.join(app.getPath("userData"), "settings.json");

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

const getDefaultYears = () => {
  const currentYear = new Date().getFullYear();
  const years = new Set<string>();

  for (let offset = -5; offset <= 5; offset += 1) {
    years.add(String(currentYear + offset));
  }

  return Array.from(years).sort((a, b) => Number(a) - Number(b));
};

const loadSettings = async () => {
  try {
    const settings = JSON.parse(
      await fs.readFile(getSettingsPath(), "utf8")
    ) as {
      projectsRoot?: string;
      labels?: DirectoryItem[];
      people?: DirectoryItem[];
      projectTags?: Record<string, ProjectTags>;
    };

    if (settings.projectsRoot) {
      projectsRoot = settings.projectsRoot;
    }

    labels = settings.labels || [];
    people = settings.people || [];
    projectTags = settings.projectTags || {};
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Could not load Atom settings:", error);
    }
  }
};

const saveSettings = async () => {
  await fs.writeFile(
    getSettingsPath(),
    JSON.stringify({ projectsRoot, labels, people, projectTags }, null, 2),
    "utf8"
  );
};


// ==========================
// SQUIRREL STARTUP
// ==========================

if (started) {
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}


// ==========================
// CREATE WINDOW
// ==========================

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.resolve(__dirname, "../../src/icons/atomLogo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};


// ==========================
// GET PROJECT YEARS
// ==========================

ipcMain.handle("get-project-years", async () => {
  const years = new Set(getDefaultYears());

  try {
    const items = await fs.readdir(projectsRoot, {
      withFileTypes: true,
    });

    items
      .filter(item => item.isDirectory())
      .forEach(item => years.add(item.name));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Could not read project years:", error);
    }
  }

  return Array.from(years).sort((a, b) => Number(a) - Number(b));
});


// ==========================
// LABELS AND PEOPLE
// ==========================

const getItemsForType = (type: "label" | "person") =>
  type === "label" ? labels : people;

const getProjectPath = (
  yearOrPath: string,
  month?: string,
  projectName?: string
) => {
  if (month && projectName) {
    return path.resolve(projectsRoot, yearOrPath, month, projectName);
  }
  return path.resolve(yearOrPath);
};

const getProjectTagKey = (
  yearOrPath: string,
  month?: string,
  projectName?: string
) => {
  if (month && projectName) {
    return path.resolve(projectsRoot, yearOrPath, month, projectName);
  }
  return path.resolve(yearOrPath);
};

const isSafeProjectName = (name: string) =>
  Boolean(name) &&
  name !== "." &&
  name !== ".." &&
  !name.includes("/") &&
  !name.includes("\\");

ipcMain.handle("get-directory-items", (_event, type: "label" | "person") =>
  getItemsForType(type)
);

ipcMain.handle(
  "create-directory-item",
  async (
    _event,
    type: "label" | "person",
    item: Omit<DirectoryItem, "id">
  ) => {
    const name = item.name.trim();

    if (!name) {
      throw new Error("A name is required.");
    }

    const newItem: DirectoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      color: item.color,
    };

    getItemsForType(type).push(newItem);
    await saveSettings();

    return newItem;
  }
);

ipcMain.handle(
  "update-directory-item",
  async (_event, type: "label" | "person", item: DirectoryItem) => {
    const items = getItemsForType(type);
    const currentItem = items.find(entry => entry.id === item.id);

    if (!currentItem || !item.name.trim()) {
      throw new Error("The item could not be updated.");
    }

    currentItem.name = item.name.trim();
    currentItem.color = item.color;
    await saveSettings();

    return currentItem;
  }
);

ipcMain.handle(
  "delete-directory-item",
  async (_event, type: "label" | "person", id: string) => {
    if (type === "label") {
      labels = labels.filter(item => item.id !== id);
      Object.values(projectTags).forEach(tags => {
        tags.labelIds = tags.labelIds.filter(labelId => labelId !== id);
      });
    } else {
      people = people.filter(item => item.id !== id);
      Object.values(projectTags).forEach(tags => {
        tags.personIds = tags.personIds.filter(personId => personId !== id);
      });
    }

    await saveSettings();
  }
);

ipcMain.handle(
  "get-project-tags",
  (_event, yearOrPath: string, month?: string, projectName?: string) => {
    const key = getProjectTagKey(yearOrPath, month, projectName);
    return projectTags[key] || projectTags[path.normalize(key)] || { labelIds: [], personIds: [] };
  }
);

ipcMain.handle(
  "set-project-tags",
  async (
    _event,
    yearOrPath: string,
    month: string | ProjectTags,
    projectName?: string,
    tags?: ProjectTags
  ) => {
    let key: string;
    let targetTags: ProjectTags;
    if (typeof month === "string" && projectName !== undefined && tags !== undefined) {
      key = getProjectTagKey(yearOrPath, month, projectName);
      targetTags = tags;
    } else {
      key = getProjectTagKey(yearOrPath);
      targetTags = month as ProjectTags;
    }

    projectTags[key] = {
      labelIds: [...new Set(targetTags?.labelIds || [])],
      personIds: [...new Set(targetTags?.personIds || [])],
    };

    await saveSettings();
    return projectTags[key];
  }
);

ipcMain.handle(
  "get-project-notes",
  async (_event, yearOrPath: string, month?: string, projectName?: string) => {
    const projectPath = getProjectPath(yearOrPath, month, projectName);
    return getProjectNotesByPath(projectPath);
  }
);

ipcMain.handle(
  "create-note",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    content?: string
  ) => {
    let projectPath: string;
    let noteContent: string;
    let projName: string;
    if (projectName !== undefined && content !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      projName = projectName;
      noteContent = content;
    } else {
      projectPath = getProjectPath(yearOrPath);
      projName = path.basename(projectPath);
      noteContent = month || "";
    }

    let project = getProjectRecordByPath(projectPath);

    if (!project) {
      project = {
        id: crypto.randomUUID(),
        name: projName,
        path: projectPath,
        description: null,
        status: null,
        project_type: "default",
        progress: 0,
        deadline: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      insertProjectRecord(project);
    }

    const noteId = crypto.randomUUID();
    return createNoteRecord({
      id: noteId,
      project_id: project.id,
      content: noteContent || "",
    });
  }
);

ipcMain.handle("update-note", async (_event, noteId: string, content: string) => {
  const updated = updateNoteRecord(noteId, content);
  if (!updated) {
    throw new Error("Note not found.");
  }
  return updated;
});

ipcMain.handle("delete-note", async (_event, noteId: string) => {
  deleteNoteRecord(noteId);
});

ipcMain.handle(
  "rename-project",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    nextProjectName?: string
  ) => {
    let currentPath: string;
    let nextName: string;
    let curKey: string;

    if (projectName !== undefined && nextProjectName !== undefined) {
      nextName = nextProjectName.trim();
      currentPath = getProjectPath(yearOrPath, month, projectName);
      curKey = getProjectTagKey(yearOrPath, month, projectName);
    } else {
      nextName = month.trim();
      currentPath = getProjectPath(yearOrPath);
      curKey = getProjectTagKey(yearOrPath);
    }

    if (!isSafeProjectName(nextName)) {
      throw new Error("Enter a valid project name.");
    }

    const nextPath = path.join(path.dirname(currentPath), nextName);
    const nextKey = path.resolve(nextPath);

    await fs.rename(currentPath, nextPath);
    updateProjectPath(currentPath, nextPath, nextName);

    if (projectTags[curKey]) {
      projectTags[nextKey] = projectTags[curKey];
      delete projectTags[curKey];
      await saveSettings();
    }

    return nextName;
  }
);

ipcMain.handle(
  "duplicate-project",
  async (
    _event,
    yearOrPath: string,
    month?: string,
    projectName?: string
  ) => {
    const currentPath = getProjectPath(yearOrPath, month, projectName);
    const currentProject = getProjectRecordByPath(currentPath);

    if (!currentProject) {
      throw new Error("Project metadata not found.");
    }

    const parentDir = path.dirname(currentPath);
    const getDuplicateName = async (name: string, index = 1): Promise<string> => {
      const suffix = index === 1 ? " Copy" : ` Copy ${index}`;
      const candidate = `${name}${suffix}`;
      const candidatePath = path.join(parentDir, candidate);
      if (await fs.stat(candidatePath).then(() => true).catch(() => false)) {
        return getDuplicateName(name, index + 1);
      }
      return candidate;
    };

    const nextName = await getDuplicateName(currentProject.name);
    const nextPath = path.join(parentDir, nextName);

    await fs.cp(currentPath, nextPath, { recursive: true });

    const duplicatedProject = {
      id: crypto.randomUUID(),
      name: nextName,
      path: nextPath,
      description: currentProject.description,
      status: currentProject.status,
      progress: currentProject.progress,
      deadline: currentProject.deadline,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    insertProjectRecord(duplicatedProject);

    const notes = getProjectNotesByPath(currentPath);
    for (const note of notes) {
      createNoteRecord({
        id: crypto.randomUUID(),
        project_id: duplicatedProject.id,
        content: note.content,
      });
    }

    const currentTagKey = getProjectTagKey(yearOrPath, month, projectName);
    const nextTagKey = path.resolve(nextPath);

    if (projectTags[currentTagKey]) {
      projectTags[nextTagKey] = projectTags[currentTagKey];
      await saveSettings();
    }

    return nextName;
  }
);

ipcMain.handle(
  "delete-project",
  async (_event, yearOrPath: string, month?: string, projectName?: string) => {
    const projectPath = getProjectPath(yearOrPath, month, projectName);

    await fs.rm(projectPath, { recursive: true, force: false });
    deleteProjectRecordByPath(projectPath);
    delete projectTags[getProjectTagKey(yearOrPath, month, projectName)];
    delete projectTags[path.resolve(projectPath)];
    await saveSettings();
  }
);


// ==========================
// GET PROJECT MONTHS
// ==========================

ipcMain.handle("get-project-months", async (_event, _year: string) => MONTH_NAMES);


// ==========================
// GET PROJECTS
// ==========================

ipcMain.handle("get-projects", async (_event, year: string, month: string) => {
  const monthPath = path.join(projectsRoot, year, month);

  try {
    const items = await fs.readdir(monthPath, {
      withFileTypes: true,
    });

    const projectPromises = items
      .filter(item => item.isDirectory())
      .map(async item => {
        const projectPath = getProjectPath(year, month, item.name);
        let project = getProjectRecordByPath(projectPath);
        let statDate: string | null = null;
        try {
          const stat = await fs.stat(projectPath);
          if (stat.birthtime && stat.birthtime.getTime() > 0) {
            statDate = stat.birthtime.toISOString();
          } else if (stat.mtime && stat.mtime.getTime() > 0) {
            statDate = stat.mtime.toISOString();
          }
        } catch {}

        if (!project) {
          const dateStr = statDate || new Date().toISOString();
          project = {
            id: crypto.randomUUID(),
            name: item.name,
            path: projectPath,
            description: null,
            status: null,
            project_type: "default",
            progress: 0,
            deadline: null,
            created_at: dateStr,
            updated_at: dateStr,
          };
          insertProjectRecord(project);
        } else if (statDate && (!project.created_at || project.created_at === project.updated_at)) {
          project = {
            ...project,
            created_at: project.created_at || statDate,
          };
        }
        return project;
      });

    const projects = await Promise.all(projectPromises);
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
});

ipcMain.handle("get-dashboard-data", async () => {
  const allProjects = getAllProjectRecords();

  const existingProjects = (
    await Promise.all(
      allProjects.map(async project => {
        try {
          const stat = await fs.stat(project.path);
          let createdAt = project.created_at;
          let updatedAt = project.updated_at;
          if (stat.birthtime && stat.birthtime.getTime() > 0) {
            createdAt = stat.birthtime.toISOString();
          }
          if (stat.mtime && stat.mtime.getTime() > 0) {
            updatedAt = stat.mtime.toISOString();
          }
          return {
            ...project,
            created_at: createdAt || project.created_at,
            updated_at: updatedAt || project.updated_at,
          };
        } catch {
          return null;
        }
      })
    )
  ).filter((p): p is NonNullable<typeof p> => p !== null);

  existingProjects.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });

  const projectsWithFiles = await Promise.all(
    existingProjects.map(async (project, index) => {
      if (index >= 4) return { ...project, files: [] as string[] };
      try {
        const entries = await fs.readdir(project.path, { withFileTypes: true });
        const files = entries
          .filter(entry => entry.isFile())
          .map(entry => entry.name)
          .slice(0, 5);
        return { ...project, files };
      } catch {
        return { ...project, files: [] as string[] };
      }
    })
  );

  return {
    projects: projectsWithFiles,
    notes: getRecentNotes(3),
  };
});

ipcMain.handle("punch-in", async () => {
  punchInRecord();
  return getTodayAttendanceSummary();
});

ipcMain.handle("punch-out", async () => {
  punchOutRecord();
  return getTodayAttendanceSummary();
});

ipcMain.handle("get-attendance-data", async () => {
  return {
    today: getTodayAttendanceSummary(),
    monthly: getMonthlyAttendanceSummary(),
  };
});

ipcMain.handle("get-monthly-attendance", async (_event, year?: number, month?: number) => {
  return getMonthlyAttendanceSummary(year, month);
});

ipcMain.handle(
  "update-project-details",
  async (
    _event,
    yearOrPath: string,
    month: string | {
      description: string;
      status: "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
      project_type?: "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";
      deadline: string;
      created_at?: string;
    },
    projectName?: string | {
      description: string;
      status: "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
      project_type?: "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";
      deadline: string;
      created_at?: string;
    },
    details?: {
      description: string;
      status: "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
      project_type?: "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";
      deadline: string;
      created_at?: string;
    }
  ) => {
    let projectPath: string;
    let projectDetails: {
      description: string;
      status: "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
      project_type?: "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";
      deadline: string;
      created_at?: string;
    };

    if (typeof month === "string" && typeof projectName === "string" && details !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      projectDetails = details;
    } else {
      projectPath = getProjectPath(yearOrPath);
      projectDetails = (month as typeof projectDetails) || (projectName as typeof projectDetails);
    }

    const project = getProjectRecordByPath(projectPath);
    if (!project) throw new Error("Project metadata not found.");

    updateProjectRecord(projectPath, {
      description: projectDetails.description?.trim() || null,
      status: projectDetails.status,
      project_type: projectDetails.project_type,
      deadline: projectDetails.deadline || null,
      created_at: projectDetails.created_at || null,
    });
    return getProjectRecordByPath(projectPath);
  }
);

ipcMain.handle(
  "toggle-project-pin",
  async (_event, year: string, month: string, projectName: string) => {
    const projectPath = getProjectPath(year, month, projectName);
    return toggleProjectPin(projectPath);
  }
);

ipcMain.handle("toggle-project-pin-by-path", async (_event, projectPath: string) => {
  return toggleProjectPin(projectPath);
});

ipcMain.handle("get-pinned-projects", async () => {
  const allPinned = getPinnedProjectRecords();
  const existing = (
    await Promise.all(
      allPinned.map(async project => {
        try {
          const stat = await fs.stat(project.path);
          let createdAt = project.created_at;
          let updatedAt = project.updated_at;
          if (stat.birthtime && stat.birthtime.getTime() > 0) {
            createdAt = stat.birthtime.toISOString();
          }
          if (stat.mtime && stat.mtime.getTime() > 0) {
            updatedAt = stat.mtime.toISOString();
          }
          return {
            ...project,
            created_at: createdAt || project.created_at,
            updated_at: updatedAt || project.updated_at,
          };
        } catch {
          return null;
        }
      })
    )
  ).filter((p): p is NonNullable<typeof p> => p !== null);

  return existing;
});

ipcMain.handle("get-recurring-projects", async () => {
  const recurringRoot = path.join(projectsRoot, "Recurring Projects");

  try {
    const items = await fs.readdir(recurringRoot, { withFileTypes: true });

    const projectPromises = items
      .filter(item => item.isDirectory())
      .map(async item => {
        const projectPath = path.join(recurringRoot, item.name);
        let project = getProjectRecordByPath(projectPath);
        let statDate: string | null = null;
        try {
          const stat = await fs.stat(projectPath);
          if (stat.birthtime && stat.birthtime.getTime() > 0) {
            statDate = stat.birthtime.toISOString();
          } else if (stat.mtime && stat.mtime.getTime() > 0) {
            statDate = stat.mtime.toISOString();
          }
        } catch {}

        if (!project) {
          const dateStr = statDate || new Date().toISOString();
          project = {
            id: crypto.randomUUID(),
            name: item.name,
            path: projectPath,
            description: null,
            status: null,
            project_type: "default",
            progress: 0,
            deadline: null,
            created_at: dateStr,
            updated_at: dateStr,
          };
          insertProjectRecord(project);
        }

        return {
          ...project,
          created_at: statDate || project.created_at,
          updated_at: statDate || project.updated_at,
        };
      });

    const projects = await Promise.all(projectPromises);
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
});


// ==========================
// GET PROJECT CONTENTS
// ==========================

ipcMain.handle(
  "get-project-contents",
  async (_event, yearOrPath: string, month?: string, projectName?: string) => {
    const projectPath = getProjectPath(yearOrPath, month, projectName);

    const items = await fs.readdir(projectPath, {
      withFileTypes: true,
    });

    return items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? "folder" : "file",
    }));
  }
);


// ==========================
// GET FOLDER CONTENTS
// ==========================

ipcMain.handle(
  "get-project-folder-contents",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    folderName?: string
  ) => {
    let projectPath: string;
    let targetFolder: string;
    if (projectName !== undefined && folderName !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      targetFolder = folderName;
    } else {
      projectPath = getProjectPath(yearOrPath);
      targetFolder = month;
    }

    const folderPath = path.join(projectPath, targetFolder);
    const items = await fs.readdir(folderPath, {
      withFileTypes: true,
    });

    return items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? "folder" : "file",
    }));
  }
);


// ==========================
// OPEN PROJECT FILE
// ==========================

ipcMain.handle(
  "open-project-content",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    relativePath?: string
  ) => {
    let projectPath: string;
    let relPath: string;
    if (projectName !== undefined && relativePath !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      relPath = relativePath;
    } else {
      projectPath = getProjectPath(yearOrPath);
      relPath = month;
    }

    const targetPath = path.resolve(projectPath, relPath);
    const pathFromProject = path.relative(projectPath, targetPath);

    if (
      pathFromProject.startsWith("..") ||
      (path.isAbsolute(relPath) && pathFromProject.startsWith(".."))
    ) {
      throw new Error("That file is outside the selected project.");
    }

    const openError = await shell.openPath(targetPath);

    if (openError) {
      throw new Error(openError);
    }
  }
);

ipcMain.handle("copy-project-path", (_event, projectPath: string) => {
  clipboard.writeText(projectPath);
});

ipcMain.handle(
  "import-project-files",
  async (_event, projectPath: string, targetFolder: string, sourcePaths: string[]) => {
    const resolvedProjectPath = path.resolve(projectPath);
    const projectRelativePath = path.relative(projectsRoot, resolvedProjectPath);
    if (projectRelativePath.startsWith("..") || path.isAbsolute(projectRelativePath)) {
      throw new Error("Invalid project path.");
    }

    const targetPath = path.resolve(resolvedProjectPath, targetFolder || "");
    const targetRelativePath = path.relative(resolvedProjectPath, targetPath);
    if (targetRelativePath.startsWith("..") || path.isAbsolute(targetRelativePath)) {
      throw new Error("Invalid destination folder.");
    }

    const targetStat = await fs.stat(targetPath);
    if (!targetStat.isDirectory()) throw new Error("Destination folder is unavailable.");

    const imported: string[] = [];
    const skipped: string[] = [];
    const seenDestinations = new Set<string>();

    for (const sourcePath of sourcePaths) {
      const resolvedSourcePath = path.resolve(sourcePath);
      const fileName = path.basename(resolvedSourcePath);
      const destinationPath = path.join(targetPath, fileName);

      if (!fileName || seenDestinations.has(destinationPath.toLowerCase()) || resolvedSourcePath === destinationPath) {
        skipped.push(fileName || sourcePath);
        continue;
      }
      seenDestinations.add(destinationPath.toLowerCase());

      let sourceStat;
      try {
        sourceStat = await fs.stat(resolvedSourcePath);
      } catch {
        skipped.push(fileName);
        continue;
      }
      if (!sourceStat.isFile()) {
        skipped.push(fileName);
        continue;
      }

      try {
        await fs.access(destinationPath);
        skipped.push(fileName);
        continue;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code && code !== "ENOENT") throw error;
      }

      await fs.copyFile(resolvedSourcePath, destinationPath);
      imported.push(fileName);
    }

    return { imported, skipped };
  }
);

const fileDragIcon = nativeImage.createFromDataURL(
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cmVjdCB4PSI0IiB5PSI2IiB3aWR0aD0iMjQiIGhlaWdodD0iMjAiIHJ4PSI0IiBmaWxsPSIjNTJCNkMyIi8+PHBhdGggZD0iTTkgMTFoMTR2Mkg5ek05IDE2aDE0djJIOXoiIGZpbGw9IiMxMzE3MUEiLz48L3N2Zz4="
);

ipcMain.on("start-file-drag", (event, projectPath: string, relativePaths: string[]) => {
  const resolvedProjectPath = path.resolve(projectPath);
  const filePaths = [...new Set(relativePaths)]
    .map(relativePath => path.resolve(resolvedProjectPath, relativePath))
    .filter(filePath => {
      const relativePath = path.relative(resolvedProjectPath, filePath);
      return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    });

  if (filePaths.length === 0) return;
  try {
    event.sender.startDrag({
      file: filePaths[0],
      files: filePaths,
      icon: fileDragIcon,
    });
  } catch (error) {
    console.error("Could not start native file drag:", error);
  }
});

ipcMain.handle(
  "rename-file",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName: string,
    fileName?: string,
    nextFileName?: string
  ) => {
    let projectPath: string;
    let curFile: string;
    let nxtFile: string;
    if (fileName !== undefined && nextFileName !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      curFile = fileName;
      nxtFile = nextFileName;
    } else {
      projectPath = getProjectPath(yearOrPath);
      curFile = month;
      nxtFile = projectName;
    }

    const currentPath = path.join(projectPath, curFile);
    const nextPath = path.join(projectPath, nxtFile);

    if (currentPath === nextPath) {
      return;
    }

    await fs.rename(currentPath, nextPath);
  }
);

ipcMain.handle(
  "duplicate-file",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    fileName?: string
  ) => {
    let projectPath: string;
    let targetFileName: string;
    if (projectName !== undefined && fileName !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      targetFileName = fileName;
    } else {
      projectPath = getProjectPath(yearOrPath);
      targetFileName = month;
    }

    const currentPath = path.join(projectPath, targetFileName);
    const stat = await fs.stat(currentPath);
    const isDir = stat.isDirectory();
    const parentDir = path.dirname(currentPath);
    const ext = isDir ? "" : path.extname(targetFileName);
    const base = isDir ? path.basename(targetFileName) : path.basename(targetFileName, ext);
    let nextName = `${base} copy${ext}`;
    let nextPath = path.join(parentDir, nextName);
    let counter = 1;

    while (await fs.stat(nextPath).then(() => true).catch(() => false)) {
      nextName = `${base} copy ${counter}${ext}`;
      nextPath = path.join(parentDir, nextName);
      counter += 1;
    }

    if (isDir) {
      await fs.cp(currentPath, nextPath, { recursive: true });
    } else {
      await fs.copyFile(currentPath, nextPath);
    }
  }
);

ipcMain.handle(
  "delete-file",
  async (
    _event,
    yearOrPath: string,
    month: string,
    projectName?: string,
    fileName?: string
  ) => {
    let projectPath: string;
    let targetFileName: string;
    if (projectName !== undefined && fileName !== undefined) {
      projectPath = getProjectPath(yearOrPath, month, projectName);
      targetFileName = fileName;
    } else {
      projectPath = getProjectPath(yearOrPath);
      targetFileName = month;
    }

    const targetPath = path.join(projectPath, targetFileName);
    await fs.rm(targetPath, { recursive: true, force: true });
  }
);


// ==========================
// PROJECT ROOT SETTINGS
// ==========================

ipcMain.handle("get-projects-root", () => projectsRoot);

ipcMain.handle("choose-projects-root", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose main projects folder",
    properties: ["openDirectory", "createDirectory"],
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("set-projects-root", async (_event, newRoot: string) => {
  const root = newRoot.trim();
  const stats = await fs.stat(root);

  if (!stats.isDirectory()) {
    throw new Error("The selected path is not a folder.");
  }

  projectsRoot = root;
  await saveSettings();

  return projectsRoot;
});


// ==========================
// CREATE PROJECT
// ==========================

ipcMain.handle(
  "create-project",
  async (
    _event,
    year: string,
    month: string,
    projectName: string,
    details?: {
      description?: string;
      status?: "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
      project_type?: "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";
      deadline?: string;
      created_at?: string;
    }
  ) => {
    const cleanName = projectName.trim();

    if (!cleanName) {
      throw new Error("Project name cannot be empty.");
    }

    const monthPath = path.join(projectsRoot, year, month);
    const projectPath = path.join(monthPath, cleanName);

    await fs.mkdir(monthPath, { recursive: true });
    await fs.mkdir(projectPath);

    const projectId = crypto.randomUUID();
    insertProjectRecord({
      id: projectId,
      name: cleanName,
      path: projectPath,
      description: details?.description?.trim() || null,
      status: details?.status ?? "not-started",
      project_type: details?.project_type ?? "default",
      progress: 0,
      deadline: details?.deadline || null,
      created_at: details?.created_at || null,
    });

    console.log("Created project:", projectPath);

    return {
      name: cleanName,
      path: projectPath,
    };
  }
);


// ==========================
// APP READY
// ==========================

app.whenReady().then(async () => {
  await loadSettings();
  await initializeDatabase(app.getPath("userData"));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});


// ==========================
// CLOSE
// ==========================

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
