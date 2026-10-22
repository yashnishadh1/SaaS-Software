import { useState, useEffect, type SyntheticEvent } from 'react';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
  WorkspaceMemberInfo,
} from '../types/task';

interface TaskFormModalProps {
  isOpen: boolean;
  initialData?: Task | null | undefined;
  members: WorkspaceMemberInfo[];
  onClose: () => void;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  isSubmitting: boolean;
  apiErrors?: Record<string, string[]> | null | undefined;
}

export function TaskFormModal({
  isOpen,
  initialData,
  members,
  onClose,
  onSubmit,
  isSubmitting,
  apiErrors,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description ?? '');
      setStatus(initialData.status);
      setPriority(initialData.priority);
      setDueDate(
        initialData.dueDate ? new Date(initialData.dueDate).toISOString().slice(0, 10) : '',
      );
      setAssigneeId(initialData.assigneeId ?? '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setDueDate('');
      setAssigneeId('');
    }
    setClientErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errs['title'] = 'Title is required.';
    } else if (trimmedTitle.length > 200) {
      errs['title'] = 'Title cannot exceed 200 characters.';
    }

    if (description.trim().length > 2000) {
      errs['description'] = 'Description cannot exceed 2000 characters.';
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const formattedDueDate = dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : null;

    if (isEditing) {
      const payload: UpdateTaskInput = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        priority,
        dueDate: formattedDueDate,
        assigneeId: assigneeId ? assigneeId : null,
      };
      void onSubmit(payload);
    } else {
      const payload: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: formattedDueDate,
        assigneeId: assigneeId || undefined,
      };
      void onSubmit(payload);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Task' : 'Create New Task'}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="task-title">
                Task Title <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (clientErrors['title']) {
                    setClientErrors((prev) => ({ ...prev, title: '' }));
                  }
                }}
                placeholder="e.g. Implement user authentication"
                required
                disabled={isSubmitting}
                autoFocus
              />
              {clientErrors['title'] && <p className="form-error">{clientErrors['title']}</p>}
              {apiErrors?.['title'] && (
                <p className="form-error">{apiErrors['title'].join(', ')}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="task-description">Description</label>
              <textarea
                id="task-description"
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (clientErrors['description']) {
                    setClientErrors((prev) => ({ ...prev, description: '' }));
                  }
                }}
                placeholder="Detailed task description and requirements..."
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.6rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                  resize: 'vertical',
                }}
              />
              {clientErrors['description'] && (
                <p className="form-error">{clientErrors['description']}</p>
              )}
              {apiErrors?.['description'] && (
                <p className="form-error">{apiErrors['description'].join(', ')}</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="task-status">Status</label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as TaskStatus);
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as TaskPriority);
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="task-due-date">Due Date</label>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-assignee">Assignee</label>
                <select
                  id="task-assignee"
                  value={assigneeId}
                  onChange={(e) => {
                    setAssigneeId(e.target.value);
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName ? `${m.displayName} (${m.email})` : m.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
