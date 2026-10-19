import type { Customer } from '../types/customer';

interface ArchiveConfirmModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isArchiving: boolean;
}

export function ArchiveConfirmModal({
  customer,
  isOpen,
  onClose,
  onConfirm,
  isArchiving,
}: ArchiveConfirmModalProps) {
  if (!isOpen || !customer) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>Archive Customer</h3>
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
            Are you sure you want to archive <strong>{customer.name}</strong>?
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            This customer will be soft-deleted and removed from active customer lists. Historical
            records will be preserved in accordance with workspace data retention rules.
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
            {isArchiving ? 'Archiving…' : 'Archive Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
