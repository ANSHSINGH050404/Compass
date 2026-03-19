export const Log = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
};

export const FS = {
  isFile: (path: string) => true, // Mock
  isDirectory: (path: string) => true, // Mock
  exists: (path: string) => true, // Mock
};

export const StringUtils = {
  slugify: (str: string) => str.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
  truncate: (str: string, len: number) => str.length > len ? str.substring(0, len) + '...' : str,
};
