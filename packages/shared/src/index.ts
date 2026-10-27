export const PRODUCT_NAME = "Nexora";
export const FOUNDATION_VERSION = "0.1.0";
export {
  DeploymentProfile,
  loadDeploymentPolicy,
  normalizeAuthority,
  normalizeOrigin,
} from "./deployment";
export type { DeploymentPolicy } from "./deployment";
export { CustomerStatus } from "./customer-status";
export type { CustomerStatusCode } from "./customer-status";
export { CustomerStatusLabelsVi } from "./customer-status-labels";
export { PaginationLimits, parsePositiveInteger, parsePagination } from "./validation/pagination";
export { normalizeBoundedText, normalizeRawBoundedText } from "./validation/text";
export { CustomerInputLimits } from "./validation/customer-limits";
