import { defineCapability } from "./helpers"

/**
 * Storage — file and folder storage with shared links and permission control.
 * Mirrors the `*:storage:file`, `*:storage:folder` and `storage:read` backend
 * route permissions.
 */
export const storageCapabilities = [
  defineCapability({
    name: "storage.filesCreate",
    description: "Upload and create storage files",
    category: "storage",
    permissions: ["create:storage:file"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "storage.filesRead",
    description: "Read, search, and download storage files",
    category: "storage",
    permissions: ["view:storage:file"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "storage.filesUpdate",
    description: "Update file metadata or move files",
    category: "storage",
    permissions: ["update:storage:file"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "storage.filesShare",
    description: "Share files and manage their permissions",
    category: "storage",
    permissions: ["share:storage:file"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "storage.filesDelete",
    description: "Delete storage files",
    category: "storage",
    permissions: ["delete:storage:file"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "storage.stats",
    description: "Read storage usage statistics",
    category: "storage",
    permissions: ["storage:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "storage.foldersCreate",
    description: "Create storage folders",
    category: "storage",
    permissions: ["create:storage:folder"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "storage.foldersRead",
    description: "Read storage folders",
    category: "storage",
    permissions: ["view:storage:folder"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "storage.foldersUpdate",
    description: "Update storage folders",
    category: "storage",
    permissions: ["update:storage:folder"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "storage.foldersShare",
    description: "Share storage folders and manage their permissions",
    category: "storage",
    permissions: ["share:storage:folder"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "storage.foldersDelete",
    description: "Delete storage folders",
    category: "storage",
    permissions: ["delete:storage:folder"],
    riskLevel: "HIGH",
  }),
]