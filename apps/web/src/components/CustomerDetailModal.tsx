import type { Customer, MemberRole } from '../types/customer';
import { canEditCustomer, canArchiveCustomer } from '../types/customer';

interface CustomerDetailModalProps {
  customer: Customer | null;
  role: MemberRole;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onArchive: (customer: Customer) => void;
}

export function CustomerDetailModal({
  customer,
  role,
  onClose,
  onEdit,
  onArchive,
}: CustomerDetailModalProps) {
  if (!customer) return null;

  const canEdit = canEditCustomer(role);
  const canArchive = canArchiveCustomer(role);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>Customer Details</h3>
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
              <span className="detail-label">Name</span>
              <span className="detail-value" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                {customer.name}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Customer ID</span>
              <span
                className="detail-value"
                style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}
              >
                {customer.id}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Email</span>
              <span className="detail-value">
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    {customer.email}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>None provided</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Phone</span>
              <span className="detail-value">
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    {customer.phone}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>None provided</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Notes</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                {customer.notes ?? (
                  <span style={{ color: 'var(--text-muted)' }}>No notes entered</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Created At</span>
              <span className="detail-value">{new Date(customer.createdAt).toLocaleString()}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Last Updated</span>
              <span className="detail-value">{new Date(customer.updatedAt).toLocaleString()}</span>
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
                onArchive(customer);
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
                onEdit(customer);
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
