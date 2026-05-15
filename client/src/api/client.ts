import type { ServerResponse } from "../types";

const BASE = "/api";

export async function listServers(): Promise<ServerResponse[]> {
  const res = await fetch(`${BASE}/servers`);
  if (!res.ok) throw new Error("Failed to fetch servers");
  return res.json();
}

export async function getServer(id: string): Promise<ServerResponse> {
  const res = await fetch(`${BASE}/servers/${id}`);
  if (!res.ok) throw new Error("Failed to fetch server");
  return res.json();
}

export async function registerServer(body: object): Promise<ServerResponse> {
  const res = await fetch(`${BASE}/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to register server");
  return res.json();
}

export async function startServer(id: string): Promise<ServerResponse> {
  const res = await fetch(`${BASE}/servers/${id}/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start server");
  return res.json();
}

export async function stopServer(id: string): Promise<ServerResponse> {
  const res = await fetch(`${BASE}/servers/${id}/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop server");
  return res.json();
}

export async function deregisterServer(id: string): Promise<void> {
  const res = await fetch(`${BASE}/servers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to deregister server");
}

export async function sendCommand(id: string, command: string): Promise<string> {
  const res = await fetch(`${BASE}/servers/${id}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error("Failed to send command");
  const data = await res.json();
  return data.output as string;
}

export async function getLogs(id: string, tail = 100): Promise<string> {
  const res = await fetch(`${BASE}/servers/${id}/logs?tail=${tail}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  const data = await res.json();
  return data.logs;
}

export async function updateServer(id: string, body: object): Promise<ServerResponse> {
  const res = await fetch(`${BASE}/servers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update server");
  return res.json();
}

export interface ContainerStats {
  cpuPercent: number;
  memUsedBytes: number;
  memLimitBytes: number;
  netInBytes: number;
  netOutBytes: number;
}

export async function getStats(id: string): Promise<ContainerStats> {
  const res = await fetch(`${BASE}/servers/${id}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  type: "text" | "binary" | "directory";
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export async function listFiles(id: string, dirPath = "/"): Promise<DirectoryListing> {
  const res = await fetch(`${BASE}/servers/${id}/files?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) throw new Error("Failed to list files");
  return res.json();
}

export async function readFile(id: string, filePath: string): Promise<string> {
  const res = await fetch(`${BASE}/servers/${id}/files/content?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error("Failed to read file");
  const data = await res.json();
  return data.content;
}

export async function writeFile(id: string, filePath: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/servers/${id}/files/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) throw new Error("Failed to save file");
}

export async function deleteFile(id: string, filePath: string): Promise<void> {
  const res = await fetch(`${BASE}/servers/${id}/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete file");
}

export async function renameFile(id: string, filePath: string, newName: string): Promise<void> {
  const res = await fetch(`${BASE}/servers/${id}/files/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, newName }),
  });
  if (!res.ok) throw new Error("Failed to rename file");
}

export async function createFolder(id: string, folderPath: string): Promise<void> {
  const res = await fetch(`${BASE}/servers/${id}/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
}

export async function uploadFiles(id: string, dirPath: string, files: File[]): Promise<void> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`${BASE}/servers/${id}/files/upload?path=${encodeURIComponent(dirPath)}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload files");
}

export function getDownloadUrl(id: string, filePath: string): string {
  return `${BASE}/servers/${id}/files/download?path=${encodeURIComponent(filePath)}`;
}