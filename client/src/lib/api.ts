export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface StaffUser {
  id: number;
  fullName: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  roles: string[];
}

export interface Role {
  id: number;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
}

export interface Permission {
  id: number;
  key: string;
  description: string;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Check that the API and MySQL are running.",
    );
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}

export function json(
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export async function uploadApi<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const body = new FormData();
  body.append("workbook", file);
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      body,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Check that the Node.js backend is running.",
    );
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new Error(data.error || `Upload failed (${response.status})`);
  return data as T;
}
