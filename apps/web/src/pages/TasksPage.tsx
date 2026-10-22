import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskArchiveModal } from '../components/TaskArchiveModal';
import {
  fetchWorkspaces,
  createWorkspace,
  fetchTasks,
  createTask,
  updateTask,
  archiveTask,
  fetchWorkspaceMembers,
  ApiError,
} from '../lib/api';
import type { Workspace } from '../types/customer';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskPagination,
  TaskStatus,
  TaskPriority,
  WorkspaceMemberInfo,
} from '../types/task';
import { canCreateTask, canEditTask, canArchiveTask } from '../types/task';

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function TasksPage() {
  const { getIdToken } = useAuth();
  const { workspaceId: paramWorkspaceId } = useParams<{ workspaceId?: string }>();
  const navigate = useNavigate();

  // ── Workspaces state ───────────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Quick workspace creation state (if user has none)
  const [newWsName, setNewWsName] = useState('');
  const [newWsSlug, setNewWsSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);

  // Workspace members for assignee selection
  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);

  // Ref to prevent stale responses from overwriting current task list
  const latestTaskRequestId = useRef(0);

  // ── Tasks state ────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<TaskPagination>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [loadingTasks, setLoadingTasks] = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');

  // ── Feedback alerts ────────────────────────────────────────────────────────
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Modal states ───────────────────────────────────────────────────────────
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string[]> | null>(null);

  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Task | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // ── Load workspaces on mount ───────────────────────────────────────────────
  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    setApiError(null);
    try {
      const token = await getIdToken();
      const list = await fetchWorkspaces(token);
      setWorkspaces(list);

      if (list.length > 0) {
        const first = list[0];
        const selected = paramWorkspaceId
          ? (list.find((w) => w.id === paramWorkspaceId) ?? first ?? null)
          : (first ?? null);
        setActiveWorkspace(selected);
      } else {
        setActiveWorkspace(null);
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to load workspaces.');
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [getIdToken, paramWorkspaceId]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  // ── Load workspace members for assignee dropdown ───────────────────────────
  const loadMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const token = await getIdToken();
      const list = await fetchWorkspaceMembers(token, activeWorkspace.id);
      setMembers(list);
    } catch {
      // Non-critical: assignee dropdown will have fallback
    }
  }, [activeWorkspace, getIdToken]);

  useEffect(() => {
    if (activeWorkspace) {
      void loadMembers();
    } else {
      setMembers([]);
    }
  }, [activeWorkspace, loadMembers]);

  // ── Load tasks for active workspace ────────────────────────────────────────
  const loadTasks = useCallback(
    async (page = 1) => {
      if (!activeWorkspace) return;
      const requestId = ++latestTaskRequestId.current;
      setLoadingTasks(true);
      setApiError(null);
      try {
        const token = await getIdToken();
        const data = await fetchTasks(token, activeWorkspace.id, {
          page,
          limit: 20,
          status: (statusFilter || undefined) as TaskStatus | undefined,
          priority: (priorityFilter || undefined) as TaskPriority | undefined,
          assigneeId: assigneeFilter || undefined,
          search: searchQuery.trim() || undefined,
        });

        if (requestId === latestTaskRequestId.current) {
          setTasks(data.tasks);
          setPagination(data.pagination);
        }
      } catch (err: unknown) {
        if (requestId === latestTaskRequestId.current) {
          setApiError(err instanceof Error ? err.message : 'Failed to load tasks.');
        }
      } finally {
        if (requestId === latestTaskRequestId.current) {
          setLoadingTasks(false);
        }
      }
    },
    [activeWorkspace, getIdToken, statusFilter, priorityFilter, assigneeFilter, searchQuery],
  );

  useEffect(() => {
    if (activeWorkspace) {
      void loadTasks(1);
    } else {
      latestTaskRequestId.current++;
      setTasks([]);
    }
  }, [activeWorkspace, loadTasks]);

  // ── Workspace switcher ─────────────────────────────────────────────────────
  const handleWorkspaceChange = (wsId: string) => {
    const selected = workspaces.find((w) => w.id === wsId);
    if (selected) {
      setActiveWorkspace(selected);
      void navigate(`/workspaces/${selected.id}/tasks`);
    }
  };

  // ── Quick Workspace Creation (if 0 workspaces) ─────────────────────────────
  const handleCreateWorkspace = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !newWsSlug.trim()) return;
    setCreatingWs(true);
    setApiError(null);
    void (async () => {
      try {
        const token = await getIdToken();
        const created = await createWorkspace(token, newWsName.trim(), newWsSlug.trim());
        setSuccessMessage(`Workspace "${created.name}" created.`);
        setNewWsName('');
        setNewWsSlug('');
        setSlugEdited(false);
        await loadWorkspaces();
      } catch (err: unknown) {
        setApiError(err instanceof Error ? err.message : 'Failed to create workspace.');
      } finally {
        setCreatingWs(false);
      }
    })();
  };

  // ── Permissions ────────────────────────────────────────────────────────────
  const role = activeWorkspace?.role ?? 'viewer';
  const canCreate = canCreateTask(role);
  const canEdit = canEditTask(role);
  const canArchive = canArchiveTask(role);

  // ── Add/Edit Submit ────────────────────────────────────────────────────────
  const handleFormSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    if (!activeWorkspace) return;
    setIsSubmittingForm(true);
    setFormFieldErrors(null);
    setApiError(null);
    try {
      const token = await getIdToken();
      if (editingTask) {
        await updateTask(token, activeWorkspace.id, editingTask.id, data);
        setSuccessMessage(`Task "${data.title ?? editingTask.title}" updated successfully.`);
      } else {
        const created = await createTask(token, activeWorkspace.id, data as CreateTaskInput);
        setSuccessMessage(`Task "${created.title}" created successfully.`);
      }
      setFormModalOpen(false);
      setEditingTask(null);
      await loadTasks(pagination.page);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.issues) {
        setFormFieldErrors(err.issues);
      } else {
        setApiError(err instanceof Error ? err.message : 'Operation failed.');
      }
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // ── Archive Confirm ────────────────────────────────────────────────────────
  const handleArchiveConfirm = async () => {
    if (!activeWorkspace || !archiveTarget) return;
    setIsArchiving(true);
    setApiError(null);
    try {
      const token = await getIdToken();
      await archiveTask(token, activeWorkspace.id, archiveTarget.id);
      setSuccessMessage(`Task "${archiveTarget.title}" archived successfully.`);
      setArchiveTarget(null);
      await loadTasks(pagination.page);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to archive task.');
    } finally {
      setIsArchiving(false);
    }
  };

  const formatStatus = (s: string) => {
    switch (s) {
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'done':
        return 'Done';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s;
    }
  };

  const formatPriority = (p: string) => {
    switch (p) {
      case 'low':
        return 'Low';
      case 'medium':
        return 'Medium';
      case 'high':
        return 'High';
      case 'urgent':
        return 'Urgent';
      default:
        return p;
    }
  };

  return (
    <div className="app-container">
      <Navigation />

      <main className="main-content">
        <div className="page-header">
          <div className="header-titles">
            <h1>Tasks Management</h1>
            <p className="header-subtitle">
              Workspace-scoped tasks with role-based permissions, assignee tracking, and priority.
            </p>
          </div>
          {activeWorkspace && canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingTask(null);
                setFormFieldErrors(null);
                setFormModalOpen(true);
              }}
            >
              + Create Task
            </button>
          )}
        </div>

        {/* Global Alerts */}
        {apiError && (
          <div className="alert alert-error" role="alert">
            <span>{apiError}</span>
            <button
              type="button"
              onClick={() => {
                setApiError(null);
              }}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="status">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => {
                setSuccessMessage(null);
              }}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Loading Workspaces */}
        {loadingWorkspaces ? (
          <div className="state-container">
            <div className="spinner" />
            <p className="state-desc">Loading workspaces…</p>
          </div>
        ) : workspaces.length === 0 ? (
          /* Empty Workspaces State */
          <div className="table-wrapper" style={{ padding: '2rem' }}>
            <div className="state-container">
              <h2 className="state-title">No Workspace Found</h2>
              <p className="state-desc">
                You are not currently a member of any workspace. Create a workspace below to start
                managing tasks.
              </p>

              <form
                onSubmit={handleCreateWorkspace}
                style={{ width: '100%', maxWidth: '400px', marginTop: '1rem' }}
              >
                <div className="form-group">
                  <label htmlFor="ws-name">Workspace Name</label>
                  <input
                    id="ws-name"
                    type="text"
                    value={newWsName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewWsName(val);
                      if (!slugEdited) {
                        setNewWsSlug(normalizeSlug(val));
                      }
                    }}
                    placeholder="e.g. Acme HQ"
                    required
                    disabled={creatingWs}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ws-slug">Workspace Slug</label>
                  <input
                    id="ws-slug"
                    type="text"
                    value={newWsSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setNewWsSlug(e.target.value);
                    }}
                    placeholder="e.g. acme-hq"
                    required
                    disabled={creatingWs}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={creatingWs}
                >
                  {creatingWs ? 'Creating Workspace…' : 'Create Workspace'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Workspace Selector Bar */}
            <div className="workspace-bar">
              <label htmlFor="active-ws-select" className="workspace-label">
                Active Workspace:
              </label>
              <select
                id="active-ws-select"
                className="workspace-select"
                value={activeWorkspace?.id ?? ''}
                onChange={(e) => {
                  handleWorkspaceChange(e.target.value);
                }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.slug})
                  </option>
                ))}
              </select>

              {activeWorkspace && (
                <span className={`role-pill role-${activeWorkspace.role}`}>
                  Role: {activeWorkspace.role}
                </span>
              )}

              {!canCreate && (
                <span
                  style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: 'auto' }}
                >
                  {role === 'viewer'
                    ? 'Viewer access (read-only)'
                    : 'Member access (can view & create)'}
                </span>
              )}
            </div>

            {/* Controls Bar: Search + Filters */}
            <div className="controls-bar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search tasks by title or description…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
              >
                <select
                  className="workspace-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                  }}
                  aria-label="Filter by status"
                >
                  <option value="">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  className="workspace-select"
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                  }}
                  aria-label="Filter by priority"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>

                <select
                  className="workspace-select"
                  value={assigneeFilter}
                  onChange={(e) => {
                    setAssigneeFilter(e.target.value);
                  }}
                  aria-label="Filter by assignee"
                >
                  <option value="">All Assignees</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName ?? m.email}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    void loadTasks(pagination.page);
                  }}
                  disabled={loadingTasks}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Tasks Table / Content State */}
            {loadingTasks ? (
              <div className="table-wrapper">
                <div className="state-container">
                  <div className="spinner" />
                  <p className="state-desc">Loading tasks…</p>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <div className="table-wrapper">
                <div className="state-container">
                  <h3 className="state-title">
                    {searchQuery || statusFilter || priorityFilter || assigneeFilter
                      ? 'No Matching Tasks'
                      : 'No Tasks Found'}
                  </h3>
                  <p className="state-desc">
                    {searchQuery || statusFilter || priorityFilter || assigneeFilter
                      ? 'No tasks matched your current search and filter criteria.'
                      : 'No active tasks found in this workspace.'}
                  </p>
                  {canCreate && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingTask(null);
                        setFormFieldErrors(null);
                        setFormModalOpen(true);
                      }}
                    >
                      + Create First Task
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                      <th>Due Date</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailTask(task);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                              textAlign: 'left',
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px',
                            }}
                          >
                            {task.title}
                          </button>
                        </td>
                        <td>
                          <span className={`status-pill status-${task.status}`}>
                            {formatStatus(task.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-pill priority-${task.priority}`}>
                            {formatPriority(task.priority)}
                          </span>
                        </td>
                        <td>
                          {task.assignee ? (
                            <span className="user-badge" style={{ margin: 0 }}>
                              {task.assignee.displayName ?? task.assignee.email}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          {task.dueDate ? (
                            <span style={{ fontSize: '0.85rem' }}>
                              {new Date(task.dueDate).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {new Date(task.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.5rem',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setDetailTask(task);
                              }}
                            >
                              View
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingTask(task);
                                  setFormFieldErrors(null);
                                  setFormModalOpen(true);
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {canArchive && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setArchiveTarget(task);
                                }}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="pagination-bar">
                  <span className="pagination-info">
                    Showing {tasks.length} of {pagination.total} tasks
                  </span>
                  <div className="pagination-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        void loadTasks(pagination.page - 1);
                      }}
                      disabled={pagination.page <= 1 || loadingTasks}
                    >
                      &larr; Previous
                    </button>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Page {pagination.page} of{' '}
                      {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        void loadTasks(pagination.page + 1);
                      }}
                      disabled={
                        pagination.page >= Math.ceil(pagination.total / pagination.limit) ||
                        loadingTasks
                      }
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <TaskFormModal
        isOpen={formModalOpen}
        initialData={editingTask}
        members={members}
        onClose={() => {
          setFormModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmittingForm}
        apiErrors={formFieldErrors}
      />

      <TaskDetailModal
        task={detailTask}
        role={role}
        onClose={() => {
          setDetailTask(null);
        }}
        onEdit={(task) => {
          setEditingTask(task);
          setFormFieldErrors(null);
          setFormModalOpen(true);
        }}
        onArchive={(task) => {
          setArchiveTarget(task);
        }}
      />

      <TaskArchiveModal
        task={archiveTarget}
        isOpen={Boolean(archiveTarget)}
        onClose={() => {
          setArchiveTarget(null);
        }}
        onConfirm={handleArchiveConfirm}
        isArchiving={isArchiving}
      />
    </div>
  );
}
