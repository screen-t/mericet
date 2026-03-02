// Compatibility re-export for case-variant imports
export * from './backend-api';
export { backendApi } from './backend-api';
export default (backendApi as any) || undefined;
