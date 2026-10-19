import { useState, useEffect, type SyntheticEvent } from 'react';
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '../types/customer';

interface CustomerFormModalProps {
  isOpen: boolean;
  initialData?: Customer | null | undefined;
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput | UpdateCustomerInput) => Promise<void>;
  isSubmitting: boolean;
  apiErrors?: Record<string, string[]> | null | undefined;
}

export function CustomerFormModal({
  isOpen,
  initialData,
  onClose,
  onSubmit,
  isSubmitting,
  apiErrors,
}: CustomerFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setEmail(initialData.email ?? '');
      setPhone(initialData.phone ?? '');
      setNotes(initialData.notes ?? '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
    }
    setClientErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs['name'] = 'Name is required.';
    } else if (name.trim().length < 2) {
      errs['name'] = 'Name must be at least 2 characters.';
    } else if (name.trim().length > 100) {
      errs['name'] = 'Name cannot exceed 100 characters.';
    }

    if (email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.trim())) {
        errs['email'] = 'Please enter a valid email address.';
      }
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing) {
      const payload: UpdateCustomerInput = {
        name: name.trim(),
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      };
      void onSubmit(payload);
    } else {
      const payload: CreateCustomerInput = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
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
          <h3>{isEditing ? 'Edit Customer' : 'Add New Customer'}</h3>
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
              <label htmlFor="customer-name">
                Customer Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (clientErrors['name']) {
                    setClientErrors((prev) => ({ ...prev, name: '' }));
                  }
                }}
                placeholder="e.g. Acme Corp"
                required
                disabled={isSubmitting}
                autoFocus
              />
              {clientErrors['name'] && <p className="form-error">{clientErrors['name']}</p>}
              {apiErrors?.['name'] && <p className="form-error">{apiErrors['name'].join(', ')}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="customer-email">Email Address</label>
              <input
                id="customer-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (clientErrors['email']) {
                    setClientErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                placeholder="info@acme.com"
                disabled={isSubmitting}
              />
              {clientErrors['email'] && <p className="form-error">{clientErrors['email']}</p>}
              {apiErrors?.['email'] && (
                <p className="form-error">{apiErrors['email'].join(', ')}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="customer-phone">Phone Number</label>
              <input
                id="customer-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                }}
                placeholder="+1 (555) 012-3456"
                disabled={isSubmitting}
              />
              {apiErrors?.['phone'] && (
                <p className="form-error">{apiErrors['phone'].join(', ')}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="customer-notes">Internal Notes</label>
              <textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                }}
                placeholder="Key details, preferences, contract terms..."
                disabled={isSubmitting}
              />
              {apiErrors?.['notes'] && (
                <p className="form-error">{apiErrors['notes'].join(', ')}</p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
