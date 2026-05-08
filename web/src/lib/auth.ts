export interface FilterTemplate {
  id: string;
  name: string;
  ownerId?: string;
  visibility?: "private" | "public";
  dateFrom: string;
  dateTo: string;
  freq: string;
  selectedTypes: string[];
  managerIds: string[];
  utmSources: string[];
  utmMediums: string[];
}

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'viewer';
  avatarDataUrl?: string;
  apiKey?: string;
  tldvApiKey?: string;
  anthropicApiKey?: string;
  analysisPrompt?: string;
  savedFilters?: Record<string, unknown>;
  savedUtms?: { sources: string[]; mediums: string[] };
  savedFilterTemplates?: FilterTemplate[];
}

const STORAGE_KEY = "simla_users";
const CURRENT_USER_KEY = "simla_current_user_id";

const DEFAULT_ADMIN: User = {
  id: "1",
  email: "luisalor@yandex.ru",
  password: "Simla123",
  firstName: "Luis",
  lastName: "Alor",
  role: "admin",
};

export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const users = JSON.parse(raw) as User[];
      if (users.length > 0) return users;
    }
  } catch {
    // ignore parse errors
  }
  const initial = [DEFAULT_ADMIN];
  saveUsers(initial);
  return initial;
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUserId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, id);
  }
}

export function loginUser(email: string, password: string): User | null {
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  if (user) {
    setCurrentUserId(user.id);
    return user;
  }
  return null;
}

export function getCurrentUser(): User | null {
  const id = getCurrentUserId();
  if (!id) return null;
  const users = getUsers();
  return users.find((u) => u.id === id) ?? null;
}

export function updateUser(updated: User): void {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === updated.id);
  if (idx >= 0) {
    users[idx] = updated;
    saveUsers(users);
  }
}

export function addUser(partial: Omit<User, 'id'>): User {
  const users = getUsers();
  const maxId = users.reduce((max, u) => Math.max(max, parseInt(u.id, 10) || 0), 0);
  const newUser: User = { ...partial, id: String(maxId + 1) };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function deleteUser(id: string): void {
  const users = getUsers();
  saveUsers(users.filter((u) => u.id !== id));
}
