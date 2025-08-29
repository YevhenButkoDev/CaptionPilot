// Minimal IndexedDB wrapper for storing a library handle and draft posts
// Requires browser support for File System Access API and structured cloning of handles

export type DraftPost = {
  id: string;
  createdAt: number;
  caption: string;
  aiCaptions?: string[]; // optional list of AI-generated captions
  selectedCaptionIndex?: number; // index into aiCaptions
  images: { fileName: string; mimeType: string; size: number }[];
  projectId?: string;
  position?: number; // lower comes first; fallback to createdAt desc if missing
  status?: 'new' | 'published' | 'scheduled';
  platform?: 'instagram' | 'pinterest'; // default to instagram for backward compatibility
};

export type PinterestPost = {
  id: string;
  createdAt: number;
  description: string; // Pinterest pin description
  images: { fileName: string; mimeType: string; size: number }[];
  projectId?: string;
  websiteUrl?: string; // Pinterest-specific website URL
  position?: number; // lower comes first; fallback to createdAt desc if missing
  status?: 'new' | 'published' | 'scheduled';
};

export type Project = {
  id: string;
  name: string;
  description: string;
  images: { fileName: string; mimeType: string; size: number }[];
  tone?: string;
  website?: string;
  createdAt: number;
  position?: number; // lower comes first; fallback to createdAt desc if missing
};

export type PromptTemplate = {
  id: string;
  name: string;
  content: string; // contains placeholders { Tone }, { Mood }, { Hashtags } and { Project Description }
  createdAt: number;
};

export type PostSchedule = {
  id: string;
  projectId: string;
  frequency: '4_per_day' | '2_per_day' | '1_per_day' | '1_per_3_days' | '1_per_week';
  startAt: number; // epoch ms
  createdAt: number;
};

export type GeneratorTemplate = {
  id: string;
  name: string;
  projectId: string; // source project for images
  minImages: number;
  maxImages: number;
  prompt: string; // the actual prompt text
  postIdeas: string[]; // user-specified ideas
  moods?: string[];
  hashtags?: string;
  numPosts: number;
  createdAt: number;
};

const DB_NAME = "inst-automation";
const DB_VERSION = 7; // Increment version for new stores
const STORE_KV = "kv";
const STORE_POSTS = "draftPosts";
const STORE_PINTEREST_POSTS = "pinterestPosts";
const STORE_PROJECTS = "projects";
const STORE_PROMPTS = "prompts";
const STORE_SCHEDULES = "schedules";
const STORE_GENERATOR_TEMPLATES = "generatorTemplates";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_POSTS)) {
        const store = db.createObjectStore(STORE_POSTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROMPTS)) {
        const store = db.createObjectStore(STORE_PROMPTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SCHEDULES)) {
        const store = db.createObjectStore(STORE_SCHEDULES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_GENERATOR_TEMPLATES)) {
        const store = db.createObjectStore(STORE_GENERATOR_TEMPLATES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PINTEREST_POSTS)) {
        const store = db.createObjectStore(STORE_PINTEREST_POSTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromKv<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, "readonly");
    const store = tx.objectStore(STORE_KV);
    const req = store.get(key);
    req.onsuccess = () => {
      resolve((req.result?.value as T) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function setInKv<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, "readwrite");
    const store = tx.objectStore(STORE_KV);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLibraryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return getFromKv<FileSystemDirectoryHandle>("libraryDir");
}

export async function setLibraryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return setInKv<FileSystemDirectoryHandle>("libraryDir", handle);
}

export async function addDraftPost(post: DraftPost): Promise<void> {
  // Ensure platform is set for backward compatibility
  const postWithPlatform = {
    ...post,
    platform: post.platform || 'instagram'
  };
  
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, "readwrite");
    const store = tx.objectStore(STORE_POSTS);
    const req = store.add(postWithPlatform);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listDraftPosts(): Promise<DraftPost[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, "readonly");
    const store = tx.objectStore(STORE_POSTS);
    const request = store.getAll();
    request.onsuccess = () => {
      const posts = (request.result as DraftPost[]) || [];
      posts.sort((a, b) => {
        const ap = typeof a.position === 'number' ? a.position : undefined;
        const bp = typeof b.position === 'number' ? b.position : undefined;
        if (ap != null && bp != null) return ap - bp;
        if (ap != null) return -1;
        if (bp != null) return 1;
        return b.createdAt - a.createdAt; // newest first fallback
      });
      resolve(posts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDraftPost(id: string): Promise<DraftPost | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, "readonly");
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as DraftPost) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateDraftPost(post: DraftPost): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.put(post);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateDraftPositions(orderedIds: string[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    orderedIds.forEach((id, index) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result as DraftPost | undefined;
        if (!rec) return; // skip missing
        const updated: DraftPost = { ...rec, position: index };
        store.put(updated);
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteDraftPost(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraftPostsByProject(projectId: string): Promise<void> {
  const posts = await listDraftPosts();
  const toDelete = posts.filter(p => p.projectId === projectId).map(p => p.id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    toDelete.forEach(id => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addPrompt(prompt: PromptTemplate): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROMPTS, 'readwrite');
    const store = tx.objectStore(STORE_PROMPTS);
    const req = store.add(prompt);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listPrompts(): Promise<PromptTemplate[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROMPTS, 'readonly');
    const store = tx.objectStore(STORE_PROMPTS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as PromptTemplate[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROMPTS, 'readwrite');
    const store = tx.objectStore(STORE_PROMPTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Generator Templates CRUD
export async function addGeneratorTemplate(t: GeneratorTemplate): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATOR_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_GENERATOR_TEMPLATES);
    const req = store.add(t);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listGeneratorTemplates(): Promise<GeneratorTemplate[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATOR_TEMPLATES, 'readonly');
    const store = tx.objectStore(STORE_GENERATOR_TEMPLATES);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as GeneratorTemplate[]) || [];
      all.sort((a, b) => b.createdAt - a.createdAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGeneratorTemplate(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATOR_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_GENERATOR_TEMPLATES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Pinterest Posts CRUD
export async function addPinterestPost(post: PinterestPost): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    const req = store.add(post);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listPinterestPosts(): Promise<PinterestPost[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readonly');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    const request = store.getAll();
    request.onsuccess = () => {
      const posts = (request.result as PinterestPost[]) || [];
      posts.sort((a, b) => {
        const ap = typeof a.position === 'number' ? a.position : undefined;
        const bp = typeof b.position === 'number' ? b.position : undefined;
        if (ap != null && bp != null) return ap - bp;
        if (ap != null) return -1;
        if (bp != null) return 1;
        return b.createdAt - a.createdAt; // newest first fallback
      });
      resolve(posts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPinterestPost(id: string): Promise<PinterestPost | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readonly');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as PinterestPost) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function updatePinterestPost(post: PinterestPost): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    const req = store.put(post);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updatePinterestPostPositions(orderedIds: string[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    orderedIds.forEach((id, index) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result as PinterestPost | undefined;
        if (!rec) return; // skip missing
        const updated: PinterestPost = { ...rec, position: index };
        store.put(updated);
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deletePinterestPost(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deletePinterestPostsByProject(projectId: string): Promise<void> {
  const posts = await listPinterestPosts();
  const toDelete = posts.filter(p => p.projectId === projectId).map(p => p.id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PINTEREST_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_PINTEREST_POSTS);
    toDelete.forEach(id => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addSchedule(schedule: PostSchedule): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCHEDULES, 'readwrite');
    const store = tx.objectStore(STORE_SCHEDULES);
    const req = store.add(schedule);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listSchedulesByProject(projectId: string): Promise<PostSchedule[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCHEDULES, 'readonly');
    const store = tx.objectStore(STORE_SCHEDULES);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as PostSchedule[]) || [];
      resolve(all.filter(s => s.projectId === projectId));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listSchedules(): Promise<PostSchedule[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCHEDULES, 'readonly');
    const store = tx.objectStore(STORE_SCHEDULES);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as PostSchedule[]) || [];
      all.sort((a, b) => b.createdAt - a.createdAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCHEDULES, 'readwrite');
    const store = tx.objectStore(STORE_SCHEDULES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function addProject(project: Project): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.add(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);
    const request = store.getAll();
    request.onsuccess = () => {
      const projects = (request.result as Project[]) || [];
      projects.sort((a, b) => {
        const ap = typeof a.position === 'number' ? a.position : undefined;
        const bp = typeof b.position === 'number' ? b.position : undefined;
        if (ap != null && bp != null) return ap - bp;
        if (ap != null) return -1;
        if (bp != null) return 1;
        return b.createdAt - a.createdAt; // newest first fallback
      });
      resolve(projects);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Project) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  // First, delete all related data (cascade delete)
  try {
    // Delete Instagram posts from this project
    await deleteDraftPostsByProject(id);
    
    // Delete Pinterest posts from this project
    await deletePinterestPostsByProject(id);
    
    // Delete schedules from this project
    const schedules = await listSchedules();
    const projectSchedules = schedules.filter(s => s.projectId === id);
    for (const schedule of projectSchedules) {
      await deleteSchedule(schedule.id);
    }
    
    // Delete generator templates from this project
    const templates = await listGeneratorTemplates();
    const projectTemplates = templates.filter(t => t.projectId === id);
    for (const template of projectTemplates) {
      await deleteGeneratorTemplate(template.id);
    }
  } catch (error) {
    console.error("Failed to delete related data for project:", id, error);
    // Continue with project deletion even if cascade fails
  }

  // Finally, delete the project itself
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateProject(project: Project): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.put(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}


