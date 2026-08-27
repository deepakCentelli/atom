import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { Database as SqlJsDatabase } from "sql.js/dist/sql-wasm.js";

export type ProjectStatus = "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
export type ProjectType = "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  description: string | null;
  status: ProjectStatus | null;
  project_type: ProjectType;
  progress: number;
  deadline: string | null;
  pinned?: number;
  created_at: string;
  updated_at: string;
}

export interface NoteRecord {
  id: string;
  project_id: string | null;
  content: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;

const sqlJsModulePath = app.isPackaged
  ? path.join(process.resourcesPath, "sql.js", "dist", "sql-wasm.js")
  : require.resolve("sql.js/dist/sql-wasm.js");

// Keep sql.js outside Vite's main-process bundle: its Emscripten wrapper uses
// CommonJS module.exports and loads sql-wasm.wasm beside this file.
const initSqlJs = require(sqlJsModulePath) as typeof import("sql.js/dist/sql-wasm.js").default;

const getDatabasePath = (userDataPath: string) =>
  path.join(userDataPath, "atom.sqlite");

const now = () => new Date().toISOString();

const saveDatabase = () => {
  if (!db || !dbPath) {
    return;
  }

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
};

const createSchema = (database: SqlJsDatabase) => {
  database.run("PRAGMA foreign_keys = ON;");

  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT,
      project_type TEXT NOT NULL DEFAULT 'default',
      progress INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Existing installations may have been created before project descriptions
  // were introduced. SQLite has no ADD COLUMN IF NOT EXISTS, so ignore the
  // duplicate-column error for databases that are already up to date.
  try {
    database.run("ALTER TABLE projects ADD COLUMN description TEXT;");
  } catch {
    // Column already exists.
  }

  try {
    database.run("ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists.
  }

  try {
    database.run("ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'default';");
  } catch {
    // Column already exists.
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      punch_in TEXT NOT NULL,
      punch_out TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
  `);
};

export const initializeDatabase = async (userDataPath: string) => {
  if (db) {
    return db;
  }

  dbPath = getDatabasePath(userDataPath);
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(path.dirname(sqlJsModulePath), file),
  });

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
  }

  createSchema(db);
  saveDatabase();

  return db;
};

export const insertProjectRecord = (project: {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  status?: ProjectStatus | null;
  project_type?: ProjectType;
  progress?: number;
  deadline?: string | null;
  pinned?: number;
  created_at?: string | null;
  updated_at?: string | null;
}) => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const current = getProjectRecordByPath(project.path);
  const timestamp = now();
  const createdAt = project.created_at || (current ? current.created_at : timestamp);
  const updatedAt = project.updated_at || timestamp;
  const pinned = project.pinned !== undefined ? project.pinned : (current?.pinned ?? 0);
  const projectType = project.project_type ?? current?.project_type ?? "default";

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id,
      name,
      path,
      description,
      status,
      project_type,
      progress,
      deadline,
      pinned,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    project.id,
    project.name,
    project.path,
    project.description ?? null,
    project.status ?? null,
    projectType,
    project.progress ?? 0,
    project.deadline ?? null,
    pinned,
    createdAt,
    updatedAt,
  ]);

  saveDatabase();
};

export const updateProjectRecord = (
  projectPath: string,
  updates: {
    description?: string | null;
    status?: ProjectStatus | null;
    project_type?: ProjectType;
    deadline?: string | null;
    created_at?: string | null;
  }
) => {
  if (!db) throw new Error("Database is not initialized.");

  const timestamp = now();
  const current = getProjectRecordByPath(projectPath);
  const createdAt = updates.created_at || (current ? current.created_at : timestamp);

  const stmt = db.prepare(`
    UPDATE projects
    SET description = ?, status = ?, project_type = ?, deadline = ?, created_at = ?, updated_at = ?
    WHERE path = ?
  `);
  stmt.run([
    updates.description ?? null,
    updates.status ?? null,
    updates.project_type ?? current?.project_type ?? "default",
    updates.deadline ?? null,
    createdAt,
    timestamp,
    projectPath,
  ]);
  saveDatabase();
};

export const updateProjectPath = (
  currentPath: string,
  nextPath: string,
  nextName: string
) => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const timestamp = now();
  const stmt = db.prepare(`
    UPDATE projects
    SET path = ?, name = ?, updated_at = ?
    WHERE path = ?
  `);

  stmt.run([nextPath, nextName, timestamp, currentPath]);
  saveDatabase();
};

export const deleteProjectRecordByPath = (projectPath: string) => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`DELETE FROM projects WHERE path = ?`);
  stmt.run([projectPath]);
  saveDatabase();
};

export const createNoteRecord = (note: {
  id: string;
  project_id?: string | null;
  title?: string;
  content?: string;
}): NoteRecord => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const timestamp = now();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO notes (
      id,
      project_id,
      title,
      content,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run([note.id, note.project_id ?? null, note.title ?? null, note.content ?? "", timestamp, timestamp]);
  saveDatabase();

  return {
    id: note.id,
    project_id: note.project_id ?? null,
    title: note.title ?? undefined,
    content: note.content ?? "",
    created_at: timestamp,
    updated_at: timestamp,
  };
};

export const getProjectRecordByPath = (
  projectPath: string
): ProjectRecord | null => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM projects WHERE path = ?
  `);
  stmt.bind([projectPath]);

  const record = stmt.step() ? (stmt.getAsObject() as ProjectRecord) : null;
  stmt.free();

  return record;
};

export const getAllProjectRecords = (): ProjectRecord[] => {
  if (!db) throw new Error("Database is not initialized.");

  const stmt = db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`);
  const projects: ProjectRecord[] = [];
  while (stmt.step()) projects.push(stmt.getAsObject() as ProjectRecord);
  stmt.free();
  return projects;
};

export const getPinnedProjectRecords = (): ProjectRecord[] => {
  if (!db) throw new Error("Database is not initialized.");

  const stmt = db.prepare(`SELECT * FROM projects WHERE pinned = 1 ORDER BY updated_at DESC`);
  const projects: ProjectRecord[] = [];
  while (stmt.step()) projects.push(stmt.getAsObject() as ProjectRecord);
  stmt.free();
  return projects;
};

export const toggleProjectPin = (projectPath: string): boolean => {
  if (!db) throw new Error("Database is not initialized.");

  const current = getProjectRecordByPath(projectPath);
  if (!current) throw new Error("Project not found.");

  const nextPinned = current.pinned ? 0 : 1;
  const timestamp = now();
  const stmt = db.prepare(`
    UPDATE projects
    SET pinned = ?, updated_at = ?
    WHERE path = ?
  `);
  stmt.run([nextPinned, timestamp, projectPath]);
  saveDatabase();
  return Boolean(nextPinned);
};

export interface DashboardNoteRecord extends NoteRecord {
  project_name: string;
}

export const getRecentNotes = (limit = 3): DashboardNoteRecord[] => {
  if (!db) throw new Error("Database is not initialized.");

  const stmt = db.prepare(`
    SELECT notes.id, notes.project_id, notes.content, notes.created_at, notes.updated_at,
           projects.name AS project_name
    FROM notes
    INNER JOIN projects ON projects.id = notes.project_id
    ORDER BY notes.updated_at DESC
    LIMIT ?
  `);
  stmt.bind([limit]);
  const notes: DashboardNoteRecord[] = [];
  while (stmt.step()) notes.push(stmt.getAsObject() as DashboardNoteRecord);
  stmt.free();
  return notes;
};

export const getProjectNotesByPath = (
  projectPath: string
): NoteRecord[] => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const project = getProjectRecordByPath(projectPath);

  if (!project) {
    return [];
  }

  const stmt = db.prepare(`
    SELECT id, project_id, content, created_at, updated_at
    FROM notes
    WHERE project_id = ?
    ORDER BY updated_at DESC
  `);
  stmt.bind([project.id]);

  const notes: NoteRecord[] = [];

  while (stmt.step()) {
    notes.push(stmt.getAsObject() as NoteRecord);
  }

  stmt.free();

  return notes;
};

export const getNoteRecordById = (
  noteId: string
): NoteRecord | null => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM notes WHERE id = ?
  `);
  stmt.bind([noteId]);

  const record = stmt.step() ? (stmt.getAsObject() as NoteRecord) : null;
  stmt.free();

  return record;
};

export const updateNoteRecord = (
  noteId: string,
  updates: { content?: string; title?: string; project_id?: string | null }
): NoteRecord | null => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const timestamp = now();
  const current = getNoteRecordById(noteId);
  if (!current) return null;

  const newContent = updates.content !== undefined ? updates.content : current.content;
  const newTitle = updates.title !== undefined ? updates.title : current.title ?? null;
  const newProjectId = updates.project_id !== undefined ? updates.project_id : current.project_id;

  const stmt = db.prepare(`
    UPDATE notes
    SET content = ?, title = ?, project_id = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run([newContent, newTitle, newProjectId, timestamp, noteId]);
  saveDatabase();

  return getNoteRecordById(noteId);
};

export const getAllNotes = (): NoteRecord[] => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM notes
    ORDER BY created_at DESC
  `);
  
  const notes: NoteRecord[] = [];
  while (stmt.step()) {
    notes.push(stmt.getAsObject() as NoteRecord);
  }
  stmt.free();

  return notes;
};

export const getNotesByProjectId = (projectId: string | null): NoteRecord[] => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE project_id = ?
    ORDER BY created_at DESC
  `);
  stmt.bind([projectId]);

  const notes: NoteRecord[] = [];
  while (stmt.step()) {
    notes.push(stmt.getAsObject() as NoteRecord);
  }
  stmt.free();

  return notes;
};




export const deleteNoteRecord = (noteId: string) => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    DELETE FROM notes WHERE id = ?
  `);
  stmt.run([noteId]);
  saveDatabase();
};

export const closeDatabase = () => {
  if (!db) {
    return;
  }

  saveDatabase();
  db.close();
  db = null;
};

// ==========================
// ATTENDANCE MANAGEMENT
// ==========================

export interface AttendanceRecord {
  id: string;
  date: string;
  punch_in: string;
  punch_out: string | null;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface TodayAttendanceSummary {
  date: string;
  isPunchedIn: boolean;
  activePunchInTime: string | null;
  activeSessionElapsedSeconds: number;
  completedDurationSeconds: number;
  totalDurationSeconds: number;
  firstPunchInTime: string | null;
  lastPunchOutTime: string | null;
  sessionCount: number;
  sessions: AttendanceRecord[];
  targetSeconds: number;
  targetCompleted: boolean;
  progressPercentage: number;
}

export interface DailyAttendanceSummary {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  formattedDate: string;
  firstPunchIn: string | null;
  lastPunchOut: string | null;
  totalDurationSeconds: number;
  formattedHours: string;
  sessionCount: number;
  targetCompleted: boolean;
  progressPercentage: number;
  isActiveToday: boolean;
}

export interface MonthlyAttendanceSummary {
  year: number;
  month: number;
  monthName: string;
  daysAttended: number;
  totalDurationSeconds: number;
  totalHoursFormatted: string;
  avgHoursPerDayFormatted: string;
  targetMetDaysCount: number;
  dailySummaries: DailyAttendanceSummary[];
}

export const TARGET_WORK_SECONDS = 8.5 * 3600; // 8 hours 30 minutes = 30600 seconds

export const getLocalDateString = (dateObj: Date = new Date()): string => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getActiveAttendanceRecord = (): AttendanceRecord | null => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM attendance_records WHERE punch_out IS NULL ORDER BY punch_in DESC LIMIT 1
  `);
  const record = stmt.step() ? (stmt.getAsObject() as unknown as AttendanceRecord) : null;
  stmt.free();
  return record;
};

export const getAttendanceRecordsByDate = (dateStr: string): AttendanceRecord[] => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const stmt = db.prepare(`
    SELECT * FROM attendance_records WHERE date = ? ORDER BY punch_in ASC
  `);
  stmt.bind([dateStr]);
  const records: AttendanceRecord[] = [];
  while (stmt.step()) {
    records.push(stmt.getAsObject() as unknown as AttendanceRecord);
  }
  stmt.free();
  return records;
};

export const punchInRecord = (customTimestamp?: string): AttendanceRecord => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const active = getActiveAttendanceRecord();
  if (active) {
    return active;
  }

  const timestamp = customTimestamp || now();
  const dateObj = new Date(timestamp);
  const dateStr = getLocalDateString(dateObj);
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const stmt = db.prepare(`
    INSERT INTO attendance_records (
      id, date, punch_in, punch_out, duration_seconds, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, 0, ?, ?)
  `);
  stmt.run([id, dateStr, timestamp, timestamp, timestamp]);
  saveDatabase();

  return {
    id,
    date: dateStr,
    punch_in: timestamp,
    punch_out: null,
    duration_seconds: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

export const punchOutRecord = (customTimestamp?: string): AttendanceRecord | null => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const active = getActiveAttendanceRecord();
  if (!active) {
    return null;
  }

  const timestamp = customTimestamp || now();
  const punchInTime = new Date(active.punch_in).getTime();
  const punchOutTime = new Date(timestamp).getTime();
  const durationSeconds = Math.max(0, Math.floor((punchOutTime - punchInTime) / 1000));

  const stmt = db.prepare(`
    UPDATE attendance_records
    SET punch_out = ?, duration_seconds = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run([timestamp, durationSeconds, timestamp, active.id]);
  saveDatabase();

  return {
    ...active,
    punch_out: timestamp,
    duration_seconds: durationSeconds,
    updated_at: timestamp,
  };
};

export const getTodayAttendanceSummary = (currentDateStr?: string): TodayAttendanceSummary => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const todayStr = currentDateStr || getLocalDateString(new Date());
  const sessions = getAttendanceRecordsByDate(todayStr);
  const activeRecord = getActiveAttendanceRecord();
  const isPunchedIn = !!activeRecord && activeRecord.date === todayStr;

  let completedDuration = 0;
  let activeElapsed = 0;
  let firstPunchIn: string | null = null;
  let lastPunchOut: string | null = null;

  for (const session of sessions) {
    if (!firstPunchIn || new Date(session.punch_in) < new Date(firstPunchIn)) {
      firstPunchIn = session.punch_in;
    }
    if (session.punch_out) {
      completedDuration += session.duration_seconds || 0;
      if (!lastPunchOut || new Date(session.punch_out) > new Date(lastPunchOut)) {
        lastPunchOut = session.punch_out;
      }
    }
  }

  if (isPunchedIn && activeRecord) {
    const punchInMs = new Date(activeRecord.punch_in).getTime();
    activeElapsed = Math.max(0, Math.floor((Date.now() - punchInMs) / 1000));
  }

  const totalDurationSeconds = completedDuration + activeElapsed;
  const progressPercentage = Math.min(100, Math.round((totalDurationSeconds / TARGET_WORK_SECONDS) * 1000) / 10);
  const targetCompleted = totalDurationSeconds >= TARGET_WORK_SECONDS;

  return {
    date: todayStr,
    isPunchedIn,
    activePunchInTime: isPunchedIn && activeRecord ? activeRecord.punch_in : null,
    activeSessionElapsedSeconds: activeElapsed,
    completedDurationSeconds: completedDuration,
    totalDurationSeconds,
    firstPunchInTime: firstPunchIn,
    lastPunchOutTime: lastPunchOut,
    sessionCount: sessions.length,
    sessions,
    targetSeconds: TARGET_WORK_SECONDS,
    targetCompleted,
    progressPercentage,
  };
};

const formatSecondsToHoursMinutes = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
};

export const getMonthlyAttendanceSummary = (targetYear?: number, targetMonth?: number): MonthlyAttendanceSummary => {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const now = new Date();
  const year = targetYear !== undefined ? targetYear : now.getFullYear();
  const month = targetMonth !== undefined ? targetMonth : now.getMonth() + 1;
  const monthPadded = String(month).padStart(2, "0");
  const monthPrefix = `${year}-${monthPadded}`;

  const stmt = db.prepare(`
    SELECT * FROM attendance_records WHERE date LIKE ? ORDER BY date ASC, punch_in ASC
  `);
  stmt.bind([`${monthPrefix}%`]);

  const records: AttendanceRecord[] = [];
  while (stmt.step()) {
    records.push(stmt.getAsObject() as unknown as AttendanceRecord);
  }
  stmt.free();

  const activeRecord = getActiveAttendanceRecord();
  const todayStr = getLocalDateString(now);

  const dayMap = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    let list = dayMap.get(record.date);
    if (!list) {
      list = [];
      dayMap.set(record.date, list);
    }
    list.push(record);
  }

  const dailySummaries: DailyAttendanceSummary[] = [];
  let totalDurationSeconds = 0;
  let targetMetDaysCount = 0;

  for (const [dateStr, daySessions] of Array.from(dayMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    let dayTotalSeconds = 0;
    let firstIn: string | null = null;
    let lastOut: string | null = null;
    const isActiveToday = dateStr === todayStr && !!activeRecord;

    for (const session of daySessions) {
      if (!firstIn || new Date(session.punch_in) < new Date(firstIn)) {
        firstIn = session.punch_in;
      }
      if (session.punch_out) {
        dayTotalSeconds += session.duration_seconds || 0;
        if (!lastOut || new Date(session.punch_out) > new Date(lastOut)) {
          lastOut = session.punch_out;
        }
      } else if (isActiveToday && activeRecord) {
        const liveSecs = Math.max(0, Math.floor((Date.now() - new Date(activeRecord.punch_in).getTime()) / 1000));
        dayTotalSeconds += liveSecs;
      }
    }

    totalDurationSeconds += dayTotalSeconds;
    const targetCompleted = dayTotalSeconds >= TARGET_WORK_SECONDS;
    if (targetCompleted) {
      targetMetDaysCount += 1;
    }

    const dateParts = dateStr.split("-").map(Number);
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];
    const formattedDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });

    dailySummaries.push({
      date: dateStr,
      dayOfWeek,
      dayNumber: dateParts[2],
      formattedDate,
      firstPunchIn: firstIn,
      lastPunchOut: lastOut,
      totalDurationSeconds: dayTotalSeconds,
      formattedHours: formatSecondsToHoursMinutes(dayTotalSeconds),
      sessionCount: daySessions.length,
      targetCompleted,
      progressPercentage: Math.min(100, Math.round((dayTotalSeconds / TARGET_WORK_SECONDS) * 1000) / 10),
      isActiveToday,
    });
  }

  const daysAttended = dailySummaries.length;
  const avgSeconds = daysAttended > 0 ? Math.round(totalDurationSeconds / daysAttended) : 0;
  const monthName = new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long" });

  return {
    year,
    month,
    monthName,
    daysAttended,
    totalDurationSeconds,
    totalHoursFormatted: formatSecondsToHoursMinutes(totalDurationSeconds),
    avgHoursPerDayFormatted: formatSecondsToHoursMinutes(avgSeconds),
    targetMetDaysCount,
    dailySummaries,
  };
};
