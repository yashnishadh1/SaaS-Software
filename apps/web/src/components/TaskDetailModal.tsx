import type { Task } from '../types/task';
import type { MemberRole } from '../types/customer';
import { canEditTask, canArchiveTask } from '../types/task';

interface TaskDetailModalProps {
  task: Task | null;
  role: MemberRole;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
}

export function TaskDetailModal({ task, role, onClose, onEdit, onArchive }: TaskDetailModalProps) {
  if (!task) return null;

  const canEdit = canEditTask(role);
  const canArchive = canArchiveTask(role);

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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>Task Details</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-label">Title</span>
              <span className="detail-value" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {task.title}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span className={`status-pill status-${task.status}`}>
                    {formatStatus(task.status)}
                  </span>
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Priority</span>
                <span className="detail-value">
                  <span className={`priority-pill priority-${task.priority}`}>
                    {formatPriority(task.priority)}
                  </span>
                </span>
              </div>
            </div>

            <div className="detail-item">
              <span className="detail-label">Assignee</span>
              <span className="detail-value">
                {task.assignee ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="user-badge" style={{ margin: 0 }}>
                      {task.assignee.displayName ?? task.assignee.email}
                    </span>
                    {task.assignee.displayName && (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        ({task.assignee.email})
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Due Date</span>
              <span className="detail-value">
                {task.dueDate ? (
                  new Date(task.dueDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>No due date</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Description</span>
              <span
                className="detail-value"
                style={{
                  whiteSpace: 'pre-wrap',
                  background: 'var(--bg-secondary)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'block',
                }}
              >
                {task.description ?? (
                  <span style={{ color: 'var(--text-muted)' }}>No description provided</span>
                )}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value" style={{ fontSize: '0.85rem' }}>
                  {new Date(task.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Last Updated</span>
                <span className="detail-value" style={{ fontSize: '0.85rem' }}>
                  {new Date(task.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {canArchive && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                onClose();
                onArchive(task);
              }}
            >
              Archive
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onClose();
                onEdit(task);
              }}
            >
              Edit
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
