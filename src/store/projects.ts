import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULTS } from '@/engine/types';
import type { PatternSetup, PicWeave } from '@/engine/types';

import { copy } from './copy';
import { setStoreHydrated } from './hydration';
import { useSettings } from './settings';
import { jsonStorage, PROJECTS_KEY } from './storage';
import type { PatternProject, PictureProject, Project } from './types';
import {
  clampK,
  clampRow,
  clampRows,
  clampWarps,
  cleanBool,
  cleanColors,
  cleanName,
  cleanSetup,
  cleanSize,
  cleanWeave,
  isRecord,
} from './validate';

export const PROJECTS_VERSION = 1;

/* ---------- File hooks (injected, so the store has no file-system import) ---------- */

export interface ProjectFiles {
  /** Delete a stored picture. Called only when no project uses the uri any more. */
  deleteFile: (uri: string) => void | Promise<void>;
}

let files: ProjectFiles | null = null;

/** Called once at start-up by the layer that owns picture files. Pass null to clear. */
export function configureProjectFiles(next: ProjectFiles | null): void {
  files = next;
}

function deleteFileSafely(uri: string): void {
  if (!files) return;
  try {
    const result = files.deleteFile(uri);
    if (result && typeof result.then === 'function') result.then(undefined, () => {});
  } catch {
    // A file that will not delete must not break the app.
  }
}

/* ---------- Shapes ---------- */

/** What is written to storage. */
export interface ProjectsData {
  projects: Record<string, Project>;
  /** Project ids, most recently updated first. */
  order: string[];
  lastOpenedId: string | null;
}

export interface NewPattern {
  /** Catalog stitch id. The store does not check it against the catalog. */
  stitchId: string;
  /** Usually the stitch name. */
  name: string;
  /** Default: settings.defaultWarps. */
  warps?: number;
  /** Default: start 0, not mirrored, settings.defaultSide. */
  setup?: Partial<PatternSetup>;
  /** Default: settings.defaultColors. */
  colors?: [string, string];
  /** Default 1. Used by the legacy import. */
  row?: number;
}

export interface NewPicture {
  /** Default: "Picture N" with the lowest unused N. */
  name?: string;
  /** Default: settings.defaultWarps. */
  warps?: number;
  imageUri?: string | null;
  imageW?: number;
  imageH?: number;
  rows?: number;
  k?: number;
  tidy?: boolean;
  weave?: PicWeave;
  /** Default 1. Used by the legacy import. */
  row?: number;
}

export interface PatternPatch {
  stitchId?: string;
  name?: string;
  warps?: number;
  setup?: Partial<PatternSetup>;
  colors?: [string, string];
}

export interface PicturePatch {
  name?: string;
  warps?: number;
  imageUri?: string | null;
  imageW?: number;
  imageH?: number;
  rows?: number;
  k?: number;
  tidy?: boolean;
  weave?: PicWeave;
}

export interface ProjectsState extends ProjectsData {
  createPattern: (input: NewPattern) => string;
  createPicture: (input?: NewPicture) => string;
  /** Changing stitchId resets start to 0 and row to 1; changing start resets row to 1. */
  updatePattern: (id: string, patch: PatternPatch) => void;
  /** A new imageUri resets rows to 0 (auto) and row to 1, and deletes the old file if unused. */
  updatePicture: (id: string, patch: PicturePatch) => void;
  rename: (id: string, name: string) => void;
  /** Returns the new id, or null when `id` does not exist. A picture copy shares the image file. */
  duplicate: (id: string) => string | null;
  remove: (id: string) => void;
  setRow: (id: string, row: number, maxRow?: number) => void;
  nextRow: (id: string, maxRow?: number) => void;
  prevRow: (id: string) => void;
  /** Sets lastOpenedId and moves the project to the front. */
  open: (id: string) => void;
  /** Section 6 item 16: when the picture gets shorter, pull row back to H + 1 (finished). */
  clampPictureRow: (id: string, H: number) => void;
}

/* ---------- Helpers ---------- */

function newId(taken: Record<string, unknown>): string {
  let id: string;
  do {
    id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (id in taken);
  return id;
}

/** Store `project` with a fresh updatedAt and move it to the front of the order. */
function commit(s: ProjectsData, project: Project): Pick<ProjectsData, 'projects' | 'order'> {
  return {
    projects: { ...s.projects, [project.id]: { ...project, updatedAt: Date.now() } },
    order: [project.id, ...s.order.filter((id) => id !== project.id)],
  };
}

function uriInUse(projects: Record<string, Project>, uri: string): boolean {
  return Object.values(projects).some((p) => p.kind === 'picture' && p.imageUri === uri);
}

function nextPictureName(projects: Record<string, Project>): string {
  const names = new Set(Object.values(projects).map((p) => p.name));
  let n = 1;
  while (names.has(copy.pictureName(n))) n++;
  return copy.pictureName(n);
}

function cleanUri(v: unknown, fallback: string | null): string | null {
  if (v === null) return null;
  return typeof v === 'string' && v !== '' ? v : fallback;
}

/* ---------- Reading saved state ---------- */

function sanitizeProject(raw: unknown): Project | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  const base = {
    id: raw.id,
    warps: clampWarps(raw.warps),
    createdAt,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    row: clampRow(raw.row),
  };
  if (raw.kind === 'pattern') {
    return {
      ...base,
      kind: 'pattern',
      name: cleanName(raw.name, copy.patternFallbackName),
      stitchId: typeof raw.stitchId === 'string' && raw.stitchId !== '' ? raw.stitchId : DEFAULTS.stitchId,
      setup: cleanSetup(raw.setup),
      colors: cleanColors(raw.colors),
    };
  }
  if (raw.kind === 'picture') {
    return {
      ...base,
      kind: 'picture',
      name: cleanName(raw.name, copy.pictureName(1)),
      imageUri: cleanUri(raw.imageUri, null),
      imageW: cleanSize(raw.imageW),
      imageH: cleanSize(raw.imageH),
      rows: clampRows(raw.rows),
      k: clampK(raw.k),
      tidy: cleanBool(raw.tidy, DEFAULTS.tidy),
      weave: cleanWeave(raw.weave),
    };
  }
  return null;
}

/** Validate saved state: drops broken projects, clamps every field, repairs the order. */
export function sanitizeProjects(raw: unknown): ProjectsData {
  const r = isRecord(raw) ? raw : {};
  const projects: Record<string, Project> = {};
  if (isRecord(r.projects)) {
    for (const value of Object.values(r.projects)) {
      const p = sanitizeProject(value);
      if (p) projects[p.id] = p;
    }
  }
  const order: string[] = [];
  if (Array.isArray(r.order)) {
    for (const id of r.order) {
      if (typeof id === 'string' && id in projects && !order.includes(id)) order.push(id);
    }
  }
  const missing = Object.values(projects)
    .filter((p) => !order.includes(p.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => p.id);
  order.push(...missing);
  const lastOpenedId = typeof r.lastOpenedId === 'string' && r.lastOpenedId in projects ? r.lastOpenedId : null;
  return { projects, order, lastOpenedId };
}

/**
 * Reshape older saved state into the current shape. Validation happens in `merge`.
 * v0 (pre-release builds) kept projects as an array and had no `order`.
 */
export function migrateProjects(persisted: unknown, version: number): ProjectsData {
  const state: Record<string, unknown> = isRecord(persisted) ? { ...persisted } : {};
  if (version < 1 && Array.isArray(state.projects)) {
    const byId: Record<string, unknown> = {};
    for (const p of state.projects) {
      if (isRecord(p) && typeof p.id === 'string') byId[p.id] = p;
    }
    state.projects = byId;
    delete state.order;
  }
  return state as unknown as ProjectsData;
}

export const INITIAL_PROJECTS: ProjectsData = { projects: {}, order: [], lastOpenedId: null };

/* ---------- Store ---------- */

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => {
      /** Apply `fn` to one project; returning null (or the same object) changes nothing. */
      const edit = (id: string, fn: (p: Project) => Project | null): void => {
        set((s) => {
          const current = s.projects[id];
          if (!current) return s;
          const next = fn(current);
          return next && next !== current ? commit(s, next) : s;
        });
      };

      const moveRow = (id: string, row: (p: Project) => number): void =>
        edit(id, (p) => {
          const next = row(p);
          return next === p.row ? null : { ...p, row: next };
        });

      return {
        ...INITIAL_PROJECTS,

        createPattern: (input) => {
          const settings = useSettings.getState();
          const id = newId(get().projects);
          const now = Date.now();
          const project: PatternProject = {
            id,
            kind: 'pattern',
            name: cleanName(input.name, copy.patternFallbackName),
            warps: clampWarps(input.warps, settings.defaultWarps),
            createdAt: now,
            updatedAt: now,
            row: clampRow(input.row),
            stitchId: typeof input.stitchId === 'string' && input.stitchId !== '' ? input.stitchId : DEFAULTS.stitchId,
            setup: cleanSetup(input.setup, { ...DEFAULTS.setup, side: settings.defaultSide }),
            colors: cleanColors(input.colors, settings.defaultColors),
          };
          set((s) => commit(s, project));
          return id;
        },

        createPicture: (input = {}) => {
          const settings = useSettings.getState();
          const id = newId(get().projects);
          const now = Date.now();
          const project: PictureProject = {
            id,
            kind: 'picture',
            name: cleanName(input.name, nextPictureName(get().projects)),
            warps: clampWarps(input.warps, settings.defaultWarps),
            createdAt: now,
            updatedAt: now,
            row: clampRow(input.row),
            imageUri: cleanUri(input.imageUri, null),
            imageW: cleanSize(input.imageW),
            imageH: cleanSize(input.imageH),
            rows: clampRows(input.rows),
            k: clampK(input.k),
            tidy: cleanBool(input.tidy, DEFAULTS.tidy),
            weave: cleanWeave(input.weave),
          };
          set((s) => commit(s, project));
          return id;
        },

        updatePattern: (id, patch) =>
          edit(id, (p) => {
            if (p.kind !== 'pattern') return null;
            const stitchId = typeof patch.stitchId === 'string' && patch.stitchId !== '' ? patch.stitchId : p.stitchId;
            const stitchChanged = stitchId !== p.stitchId;
            // A new stitch starts again from its first row, unless this patch says otherwise.
            const setup = cleanSetup(patch.setup, stitchChanged ? { ...p.setup, start: 0 } : p.setup);
            const startChanged = setup.start !== p.setup.start;
            return {
              ...p,
              stitchId,
              setup,
              name: cleanName(patch.name, p.name),
              warps: clampWarps(patch.warps, p.warps),
              colors: cleanColors(patch.colors, p.colors),
              row: stitchChanged || startChanged ? 1 : p.row,
            };
          }),

        updatePicture: (id, patch) => {
          const before = get().projects[id];
          if (!before || before.kind !== 'picture') return;
          edit(id, (p) => {
            if (p.kind !== 'picture') return null;
            const imageUri = cleanUri(patch.imageUri, p.imageUri);
            const imageChanged = imageUri !== p.imageUri;
            return {
              ...p,
              imageUri,
              name: cleanName(patch.name, p.name),
              warps: clampWarps(patch.warps, p.warps),
              imageW: cleanSize(patch.imageW, p.imageW),
              imageH: cleanSize(patch.imageH, p.imageH),
              // A new picture goes back to auto rows, unless this patch says otherwise.
              rows: clampRows(patch.rows, imageChanged ? 0 : p.rows),
              k: clampK(patch.k, p.k),
              tidy: cleanBool(patch.tidy, p.tidy),
              weave: cleanWeave(patch.weave, p.weave),
              row: imageChanged ? 1 : p.row,
            };
          });
          const old = before.imageUri;
          if (old && !uriInUse(get().projects, old)) deleteFileSafely(old);
        },

        rename: (id, name) =>
          edit(id, (p) => {
            const next = cleanName(name, p.name);
            return next === p.name ? null : { ...p, name: next };
          }),

        duplicate: (id) => {
          const source = get().projects[id];
          if (!source) return null;
          const newProjectId = newId(get().projects);
          const now = Date.now();
          const dupe: Project = {
            ...source,
            ...(source.kind === 'pattern' ? { setup: { ...source.setup }, colors: [...source.colors] as [string, string] } : {}),
            id: newProjectId,
            name: cleanName(copy.copyName(source.name), source.name),
            createdAt: now,
            updatedAt: now,
          };
          set((s) => commit(s, dupe));
          return newProjectId;
        },

        remove: (id) => {
          const target = get().projects[id];
          if (!target) return;
          set((s) => {
            const projects = { ...s.projects };
            delete projects[id];
            return {
              projects,
              order: s.order.filter((x) => x !== id),
              lastOpenedId: s.lastOpenedId === id ? null : s.lastOpenedId,
            };
          });
          if (target.kind === 'picture' && target.imageUri && !uriInUse(get().projects, target.imageUri)) {
            deleteFileSafely(target.imageUri);
          }
        },

        setRow: (id, row, maxRow) => moveRow(id, (p) => clampRow(row, maxRow, p.row)),
        nextRow: (id, maxRow) => moveRow(id, (p) => clampRow(p.row + 1, maxRow)),
        prevRow: (id) => moveRow(id, (p) => clampRow(p.row - 1)),

        open: (id) =>
          set((s) => {
            const p = s.projects[id];
            return p ? { ...commit(s, p), lastOpenedId: id } : s;
          }),

        clampPictureRow: (id, H) =>
          moveRow(id, (p) => {
            if (p.kind !== 'picture' || !Number.isFinite(H) || H < 0) return p.row;
            return Math.min(p.row, Math.floor(H) + 1);
          }),
      };
    },
    {
      name: PROJECTS_KEY,
      version: PROJECTS_VERSION,
      storage: jsonStorage<ProjectsData>(),
      partialize: (s) => ({ projects: s.projects, order: s.order, lastOpenedId: s.lastOpenedId }),
      migrate: migrateProjects,
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, ...sanitizeProjects(persisted) },
      onRehydrateStorage: () => {
        setStoreHydrated('projects', false);
        return () => setStoreHydrated('projects', true);
      },
    },
  ),
);

/* ---------- Selectors ---------- */

/** All projects, most recently updated first. Stable between unrelated renders. */
export function useProjectList(): Project[] {
  const projects = useProjects((s) => s.projects);
  const order = useProjects((s) => s.order);
  return useMemo(() => order.map((id) => projects[id]).filter((p): p is Project => !!p), [projects, order]);
}

/** One project, or undefined when it does not exist (deleted, or a stale URL). */
export function useProject(id: string | null | undefined): Project | undefined {
  return useProjects((s) => (id ? s.projects[id] : undefined));
}
