export { };

declare global {

    type ProjectStatus = "not-started" | "in-progress" | "on-hold" | "cancelled" | "completed";
    type ProjectType = "graphics" | "document" | "code" | "presentation" | "video" | "image" | "default";

    interface ProjectUpdateDetails {
        description: string;
        status: ProjectStatus;
        project_type?: ProjectType;
        deadline: string;
        created_at?: string;
    }

    interface ProjectMetadata {
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

    interface Window {

        electronAPI: {

            getProjectYears:
            () => Promise<string[]>;


            getProjectMonths:
            (year: string) => Promise<string[]>;


            getProjects:
            (
                year: string,
                month: string
            ) => Promise<ProjectMetadata[]>;

            getProjectContents:
            (
                yearOrPath: string,
                month?: string,
                projectName?: string
            ) => Promise<{
                name: string;
                type: "file" | "folder";
            }[]>;

            getProjectFolderContents:
            (
                yearOrPath: string,
                month: string,
                projectName?: string,
                folderName?: string
            ) => Promise<{
                name: string;
                type: "file" | "folder";
            }[]>;


            createProject:
            (
                year: string,
                month: string,
                projectName: string,
                details?: {
                    description?: string;
                    status?: ProjectStatus;
                    project_type?: ProjectType;
                    deadline?: string;
                    created_at?: string;
                }
            ) => Promise<{

                name: string;

                path: string;

            }>;

            updateProjectDetails: {
                (year: string, month: string, projectName: string, details: ProjectUpdateDetails): Promise<ProjectMetadata | null>;
                (projectPath: string, details: ProjectUpdateDetails): Promise<ProjectMetadata | null>;
            };

            toggleProjectPin:
            (
                year: string, month: string, projectName: string
            ) => Promise<boolean>;

            toggleProjectPinByPath:
            (
                projectPath: string
            ) => Promise<boolean>;

            getPinnedProjects:
            () => Promise<ProjectMetadata[]>;

            getRecurringProjects:
            () => Promise<ProjectMetadata[]>;

            getDashboardData: () => Promise<{
                projects: (ProjectMetadata & { files: string[] })[];
                notes: {
                    id: string; project_id: string; content: string;
                    created_at: string; updated_at: string; project_name: string;
                }[];
            }>;

            getProjectsRoot:
            () => Promise<string>;

            chooseProjectsRoot:
            () => Promise<string | null>;

            setProjectsRoot:
            (projectsRoot: string) => Promise<string>;

            getDirectoryItems:
            (type: "label" | "person") => Promise<{
                id: string;
                name: string;
                color: string;
            }[]>;

            createDirectoryItem:
            (
                type: "label" | "person",
                item: { name: string; color: string; }
            ) => Promise<{
                id: string;
                name: string;
                color: string;
            }>;

            updateDirectoryItem:
            (
                type: "label" | "person",
                item: { id: string; name: string; color: string; }
            ) => Promise<{
                id: string;
                name: string;
                color: string;
            }>;

            deleteDirectoryItem:
            (type: "label" | "person", id: string) => Promise<void>;

            getProjectTags:
            (
                year: string,
                month: string,
                projectName: string
            ) => Promise<{
                labelIds: string[];
                personIds: string[];
            }>;

            setProjectTags:
            (
                year: string,
                month: string,
                projectName: string,
                tags: { labelIds: string[]; personIds: string[]; }
            ) => Promise<{
                labelIds: string[];
                personIds: string[];
            }>;

            getProjectNotes:
            (
                year: string,
                month: string,
                projectName: string
            ) => Promise<{
                id: string;
                project_id: string;
                content: string;
                created_at: string;
                updated_at: string;
            }[]>;

            createNote:
            (
                year: string,
                month: string,
                projectName: string,
                content: string
            ) => Promise<{
                id: string;
                project_id: string;
                content: string;
                created_at: string;
                updated_at: string;
            }>;

            updateNote:
            (
                noteId: string,
                content: string
            ) => Promise<{
                id: string;
                project_id: string;
                content: string;
                created_at: string;
                updated_at: string;
            }>;

            deleteNote:
            (
                noteId: string
            ) => Promise<void>;

            openProjectContent: {
                (year: string, month: string, projectName: string, relativePath: string): Promise<void>;
                (projectPath: string, relativePath: string): Promise<void>;
            };

            copyProjectPath: (projectPath: string) => Promise<void>;

            getDroppedFilePath: (file: File) => string;

            importProjectFiles: (
                projectPath: string, targetFolder: string, sourcePaths: string[]
            ) => Promise<{ imported: string[]; skipped: string[] }>;

            startFileDrag: (projectPath: string, relativePaths: string[]) => void;

            renameFile:
            (
                year: string,
                month: string,
                projectName: string,
                fileName: string,
                nextFileName: string
            ) => Promise<void>;

            duplicateFile:
            (
                year: string,
                month: string,
                projectName: string,
                fileName: string
            ) => Promise<void>;

            deleteFile:
            (
                year: string,
                month: string,
                projectName: string,
                fileName: string
            ) => Promise<void>;

            renameProject:
            (
                year: string,
                month: string,
                projectName: string,
                nextProjectName: string
            ) => Promise<string>;

            duplicateProject:
            (
                year: string,
                month: string,
                projectName: string
            ) => Promise<string>;

            deleteProject:
            (
                year: string,
                month: string,
                projectName: string
            ) => Promise<void>;

            punchIn: () => Promise<{
                date: string;
                isPunchedIn: boolean;
                activePunchInTime: string | null;
                activeSessionElapsedSeconds: number;
                completedDurationSeconds: number;
                totalDurationSeconds: number;
                firstPunchInTime: string | null;
                lastPunchOutTime: string | null;
                sessionCount: number;
                sessions: any[];
                targetSeconds: number;
                targetCompleted: boolean;
                progressPercentage: number;
            }>;

            punchOut: () => Promise<{
                date: string;
                isPunchedIn: boolean;
                activePunchInTime: string | null;
                activeSessionElapsedSeconds: number;
                completedDurationSeconds: number;
                totalDurationSeconds: number;
                firstPunchInTime: string | null;
                lastPunchOutTime: string | null;
                sessionCount: number;
                sessions: any[];
                targetSeconds: number;
                targetCompleted: boolean;
                progressPercentage: number;
            }>;

            getAttendanceData: () => Promise<{
                today: {
                    date: string;
                    isPunchedIn: boolean;
                    activePunchInTime: string | null;
                    activeSessionElapsedSeconds: number;
                    completedDurationSeconds: number;
                    totalDurationSeconds: number;
                    firstPunchInTime: string | null;
                    lastPunchOutTime: string | null;
                    sessionCount: number;
                    sessions: any[];
                    targetSeconds: number;
                    targetCompleted: boolean;
                    progressPercentage: number;
                };
                monthly: {
                    year: number;
                    month: number;
                    monthName: string;
                    daysAttended: number;
                    totalDurationSeconds: number;
                    totalHoursFormatted: string;
                    avgHoursPerDayFormatted: string;
                    targetMetDaysCount: number;
                    dailySummaries: {
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
                    }[];
                };
            }>;

            getMonthlyAttendance: (year?: number, month?: number) => Promise<{
                year: number;
                month: number;
                monthName: string;
                daysAttended: number;
                totalDurationSeconds: number;
                totalHoursFormatted: string;
                avgHoursPerDayFormatted: string;
                targetMetDaysCount: number;
                dailySummaries: {
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
                }[];
            }>;

        };

    }

}
