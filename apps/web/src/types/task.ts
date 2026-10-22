import type { MemberRole } from './customer';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskAssignee {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: TaskAssignee | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  dueDate?: string | null | undefined;
  assigneeId?: string | null | undefined;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  description?: string | null | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  dueDate?: string | null | undefined;
  assigneeId?: string | null | undefined;
}

export interface TaskFilterParams {
  status?: TaskStatus | '' | undefined;
  priority?: TaskPriority | '' | undefined;
  assigneeId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface TaskPagination {
  page: number;
  limit: number;
  total: number;
}

export interface TaskListResponse {
  tasks: Task[];
  pagination: TaskPagination;
}

export interface WorkspaceMemberInfo {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt?: string;
}

/**
 * Role permissions helper matching server-side requireWorkspaceAccess
 * - owner / admin: create, read, edit, archive
 * - member: create, read, edit
 * - viewer: read only
 */
export function canCreateTask(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function canEditTask(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function canArchiveTask(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}
