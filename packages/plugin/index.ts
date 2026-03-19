/**
 * OpenCode Plugin API
 * Public interface for third-party extensions
 */
export const Plugin = {
  define: (config: any) => {
    // Define a new plugin for OpenCode
    console.log('[Plugin] Defining plugin...');
    return config;
  }
};
