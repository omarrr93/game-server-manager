import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import type { ServerResponse } from "../../../types";
import {
  listFiles, readFile, writeFile, deleteFile,
  renameFile, createFolder, uploadFiles, getDownloadUrl,
} from "../../../api/client";
import type { FileEntry } from "../../../api/client";

interface Props {
  server: ServerResponse;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(entry: FileEntry): string {
  if (entry.isDirectory) return "📁";
  const ext = entry.name.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    txt: "📄", log: "📋", json: "📦", yaml: "📦", yml: "📦",
    toml: "📦", properties: "⚙️", cfg: "⚙️", conf: "⚙️",
    sh: "⚡", jar: "☕", zip: "🗜️", png: "🖼️", jpg: "🖼️",
  };
  return icons[ext ?? ""] ?? "📄";
}

type ModalState =
  | { type: "none" }
  | { type: "rename"; entry: FileEntry }
  | { type: "newFolder" }
  | { type: "confirmDelete"; entry: FileEntry };

export function FileManagerTab({ server }: Props) {
  const { definition } = server;
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorOriginal, setEditorOriginal] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [modalInput, setModalInput] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function loadDir(dirPath: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await listFiles(definition.id, dirPath);
      setEntries(data.entries);
      setCurrentPath(dirPath);
    } catch {
      setError("Failed to load directory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDir("/"); }, [definition.id]);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function navigateTo(dirPath: string) {
    loadDir(dirPath);
  }

  function navigateUp() {
    const parts = currentPath.replace(/\/$/, "").split("/").filter(Boolean);
    parts.pop();
    navigateTo(parts.length === 0 ? "/" : "/" + parts.join("/"));
  }

  // ─── Breadcrumbs ────────────────────────────────────────────────────────────

  function getBreadcrumbs() {
    const parts = currentPath.replace(/\/$/, "").split("/").filter(Boolean);
    const crumbs = [{ label: "root", path: "/" }];
    parts.forEach((p, i) => {
      crumbs.push({ label: p, path: "/" + parts.slice(0, i + 1).join("/") });
    });
    return crumbs;
  }

  // ─── Editor ─────────────────────────────────────────────────────────────────

  async function openFile(entry: FileEntry) {
    if (entry.type === "binary") {
      setError("Binary files cannot be edited — use download instead.");
      return;
    }
    try {
      const content = await readFile(definition.id, entry.path);
      setEditorContent(content);
      setEditorOriginal(content);
      setEditingFile(entry.path);
      setEditorError(null);
    } catch {
      setError("Failed to open file");
    }
  }

  async function saveFile() {
    if (!editingFile) return;
    setEditorSaving(true);
    setEditorError(null);
    try {
      await writeFile(definition.id, editingFile, editorContent);
      setEditorOriginal(editorContent);
    } catch {
      setEditorError("Failed to save file");
    } finally {
      setEditorSaving(false);
    }
  }

  function closeEditor() {
    if (editorContent !== editorOriginal) {
      if (!confirm("You have unsaved changes. Discard them?")) return;
    }
    setEditingFile(null);
    setEditorContent("");
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (modal.type !== "confirmDelete") return;
    setModalLoading(true);
    try {
      await deleteFile(definition.id, modal.entry.path);
      setModal({ type: "none" });
      loadDir(currentPath);
    } catch {
      setError("Failed to delete");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleRename() {
    if (modal.type !== "rename") return;
    setModalLoading(true);
    try {
      await renameFile(definition.id, modal.entry.path, modalInput);
      setModal({ type: "none" });
      setModalInput("");
      loadDir(currentPath);
    } catch {
      setError("Failed to rename");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleNewFolder() {
    if (!modalInput.trim()) return;
    setModalLoading(true);
    try {
      const folderPath = currentPath === "/"
        ? `/${modalInput}`
        : `${currentPath}/${modalInput}`;
      await createFolder(definition.id, folderPath);
      setModal({ type: "none" });
      setModalInput("");
      loadDir(currentPath);
    } catch {
      setError("Failed to create folder");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      await uploadFiles(definition.id, currentPath, files);
      loadDir(currentPath);
    } catch {
      setError("Failed to upload files");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  // ─── Editor view ────────────────────────────────────────────────────────────

  if (editingFile) {
    const ext = editingFile.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      json: "json", yaml: "yaml", yml: "yaml", toml: "ini",
      properties: "ini", sh: "shell", xml: "xml", md: "markdown",
      js: "javascript", ts: "typescript", html: "html", css: "css",
    };
    const language = langMap[ext ?? ""] ?? "plaintext";
    const isDirty = editorContent !== editorOriginal;

    return (
      <div className="flex flex-col gap-4 h-full">
        {/* Editor header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={closeEditor}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors flex-shrink-0"
            >
              ← Files
            </button>
            <span className="text-gray-700">/</span>
            <span className="text-sm text-gray-300 font-mono truncate">{editingFile}</span>
            {isDirty && (
              <span className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/50 px-2 py-0.5 rounded flex-shrink-0">
                unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editorError && (
              <span className="text-red-400 text-xs">{editorError}</span>
            )}
            <button
              onClick={saveFile}
              disabled={editorSaving || !isDirty}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {editorSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Monaco editor */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-700 min-h-[600px]">
          <Editor
            height="600px"
            language={language}
            value={editorContent}
            onChange={(val) => setEditorContent(val ?? "")}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              renderLineHighlight: "line",
              smoothScrolling: true,
            }}
          />
        </div>
      </div>
    );
  }

  // ─── File browser view ──────────────────────────────────────────────────────

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-700">/</span>}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`hover:text-white transition-colors ${
                  i === breadcrumbs.length - 1
                    ? "text-gray-200 font-medium"
                    : "text-gray-500"
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setModal({ type: "newFolder" }); setModalInput(""); }}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#22262e] text-gray-300 border border-gray-700 hover:bg-[#2d3139] transition-colors"
          >
            + Folder
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading..." : "↑ Upload"}
          </button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm px-4 py-3 rounded-xl flex justify-between">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* File table */}
      <div className="bg-[#22262e] border border-gray-700 rounded-xl overflow-hidden">

        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-700 text-xs text-gray-500 font-medium uppercase tracking-wider">
          <span className="col-span-6">Name</span>
          <span className="col-span-2">Size</span>
          <span className="col-span-3">Modified</span>
          <span className="col-span-1" />
        </div>

        {/* Up row */}
        {currentPath !== "/" && (
          <button
            onClick={navigateUp}
            className="w-full grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-800 hover:bg-[#2d3139] transition-colors text-left"
          >
            <span className="col-span-6 flex items-center gap-3 text-sm text-gray-400">
              <span>📁</span>
              <span>..</span>
            </span>
          </button>
        )}

        {/* Entries */}
        {loading ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">Empty directory</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-[#2d3139] transition-colors group"
            >
              {/* Name */}
              <button
                className="col-span-6 flex items-center gap-3 text-sm text-left min-w-0"
                onClick={() => entry.isDirectory ? navigateTo(entry.path) : openFile(entry)}
              >
                <span className="flex-shrink-0">{fileIcon(entry)}</span>
                <span className={`truncate ${entry.isDirectory ? "text-blue-300" : "text-gray-200"}`}>
                  {entry.name}
                </span>
              </button>

              {/* Size */}
              <span className="col-span-2 flex items-center text-sm text-gray-500">
                {entry.isDirectory ? "—" : formatSize(entry.size)}
              </span>

              {/* Modified */}
              <span className="col-span-3 flex items-center text-sm text-gray-500">
                {new Date(entry.modifiedAt).toLocaleDateString()}
              </span>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!entry.isDirectory && (
                  <a
                    href={getDownloadUrl(definition.id, entry.path)}
                    download={entry.name}
                    className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Download"
                  >
                    ↓
                  </a>
                )}
                <button
                  onClick={() => { setModal({ type: "rename", entry }); setModalInput(entry.name); }}
                  className="p-1.5 rounded text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setModal({ type: "confirmDelete", entry })}
                  className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {modal.type !== "none" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#22262e] border border-gray-700 rounded-xl w-full max-w-md shadow-2xl p-6 flex flex-col gap-4">

            {modal.type === "confirmDelete" && (
              <>
                <h3 className="text-base font-semibold text-white">Delete {modal.entry.isDirectory ? "Folder" : "File"}</h3>
                <p className="text-sm text-gray-400">
                  Are you sure you want to delete <span className="text-white font-mono">{modal.entry.name}</span>?
                  {modal.entry.isDirectory && " This will delete all contents recursively."}
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModal({ type: "none" })} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                  <button
                    onClick={handleDelete}
                    disabled={modalLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {modalLoading ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "rename" && (
              <>
                <h3 className="text-base font-semibold text-white">Rename</h3>
                <input
                  autoFocus
                  className="w-full bg-[#1a1d23] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModal({ type: "none" })} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                  <button
                    onClick={handleRename}
                    disabled={modalLoading || !modalInput.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {modalLoading ? "Renaming..." : "Rename"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "newFolder" && (
              <>
                <h3 className="text-base font-semibold text-white">New Folder</h3>
                <input
                  autoFocus
                  className="w-full bg-[#1a1d23] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
                  placeholder="folder-name"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewFolder()}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModal({ type: "none" })} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                  <button
                    onClick={handleNewFolder}
                    disabled={modalLoading || !modalInput.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {modalLoading ? "Creating..." : "Create"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}