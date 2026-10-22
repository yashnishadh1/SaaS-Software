import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  Workspace,
  CustomerListResponse,
} from '../types/customer';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilterParams,
  TaskListResponse,
  WorkspaceMemberInfo,
} from '../types/task';

export interface ApiErrorPayload {
  error: string;
  message?: string | undefined;
  issues?: Record<string, string[]> | undefined;
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public issues?: Record<string, string[]> | undefined;

  constructor(status: number, code: string, message: string, issues?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

async function request<T>(endpoint: string, options: RequestInit, token: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Uses Vite proxy /api -> backend server in dev, or relative in production
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorData = (data as ApiErrorPayload | null) ?? null;
    const code = errorData?.error ?? 'unknown_error';
    const message =
      errorData?.message ??
      (errorData?.issues
        ? Object.values(errorData.issues).flat().join(', ')
        : `Request failed with status ${String(res.status)}`);
    throw new ApiError(res.status, code, message, errorData?.issues);
  }

  return data as T;
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export async function fetchWorkspaces(token: string): Promise<Workspace[]> {
  const data = await request<{ workspaces: Workspace[] }>('/workspaces', { method: 'GET' }, token);
  return data.workspaces;
}

export async function createWorkspace(
  token: string,
  name: string,
  slug: string,
): Promise<Workspace> {
  const data = await request<{ workspace: Workspace }>(
    '/workspaces',
    {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    },
    token,
  );
  return data.workspace;
}

// ── Customers ────────────────────────────────────────────────────────────────

export async function fetchCustomers(
  token: string,
  workspaceId: string,
  page = 1,
  limit = 20,
): Promise<CustomerListResponse> {
  return request<CustomerListResponse>(
    `/workspaces/${encodeURIComponent(workspaceId)}/customers?page=${String(page)}&limit=${String(limit)}`,
    { method: 'GET' },
    token,
  );
}

export async function fetchCustomer(
  token: string,
  workspaceId: string,
  customerId: string,
): Promise<Customer> {
  const data = await request<{ customer: Customer }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/customers/${encodeURIComponent(customerId)}`,
    { method: 'GET' },
    token,
  );
  return data.customer;
}

export async function createCustomer(
  token: string,
  workspaceId: string,
  input: CreateCustomerInput,
): Promise<Customer> {
  const data = await request<{ customer: Customer }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/customers`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
  );
  return data.customer;
}

export async function updateCustomer(
  token: string,
  workspaceId: string,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const data = await request<{ customer: Customer }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    token,
  );
  return data.customer;
}

export async function archiveCustomer(
  token: string,
  workspaceId: string,
  customerId: string,
): Promise<void> {
  await request<unknown>(
    `/workspaces/${encodeURIComponent(workspaceId)}/customers/${encodeURIComponent(customerId)}`,
    { method: 'DELETE' },
    token,
  );
}

// ── Tasks (Phase 4) ──────────────────────────────────────────────────────────

export async function fetchTasks(
  token: string,
  workspaceId: string,
  filters: TaskFilterParams = {},
): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.search) params.set('search', filters.search);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return request<TaskListResponse>(
    `/workspaces/${encodeURIComponent(workspaceId)}/tasks${queryStr}`,
    { method: 'GET' },
    token,
  );
}

export async function fetchTask(token: string, workspaceId: string, taskId: string): Promise<Task> {
  const data = await request<{ task: Task }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'GET' },
    token,
  );
  return data.task;
}

export async function createTask(
  token: string,
  workspaceId: string,
  input: CreateTaskInput,
): Promise<Task> {
  const data = await request<{ task: Task }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
  );
  return data.task;
}

export async function updateTask(
  token: string,
  workspaceId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const data = await request<{ task: Task }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    token,
  );
  return data.task;
}

export async function archiveTask(
  token: string,
  workspaceId: string,
  taskId: string,
): Promise<void> {
  await request<unknown>(
    `/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
    token,
  );
}

export async function fetchWorkspaceMembers(
  token: string,
  workspaceId: string,
): Promise<WorkspaceMemberInfo[]> {
  const data = await request<{
    workspace: Workspace;
    members: WorkspaceMemberInfo[];
    currentUserRole: string;
  }>(`/workspaces/${encodeURIComponent(workspaceId)}`, { method: 'GET' }, token);
  return data.members;
}
