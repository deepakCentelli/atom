declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "better-sqlite3" {
  const Database: any;
  export default Database;
}

declare module "sql.js" {
  const initSqlJs: any;
  export default initSqlJs;
  export type Database = any;
}

declare module "sql.js/dist/sql-wasm.js" {
  const initSqlJs: any;
  export default initSqlJs;
  export type Database = any;
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
