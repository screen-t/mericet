// Compatibility re-export for underscore-variant imports
export * from './backend-api';
export { backendApi } from './backend-api';
export default (backendApi as any) || undefined;
