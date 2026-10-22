import type { Task } from '../types/task';

interface TaskArchiveModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isArchiving: boolean;
}

export function TaskArchiveModal({
  task,
  isOpen,
  onClose,
  onConfirm,
  isArchiving,
}: TaskArchiveModalProps) {
  if (!isOpen || !task) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>Archive Task</h3>
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
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Are you sure you want to archive <strong>{task.title}</strong>?
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            This task will be soft-deleted and removed from active task views. It will not appear in
            the workspace task board or searches.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isArchiving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              void onConfirm();
            }}
            disabled={isArchiving}
          >
            {isArchiving ? 'Archiving…' : 'Archive Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
