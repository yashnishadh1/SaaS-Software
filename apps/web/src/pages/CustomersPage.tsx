import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { ArchiveConfirmModal } from '../components/ArchiveConfirmModal';
import {
  fetchWorkspaces,
  createWorkspace,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  ApiError,
} from '../lib/api';
import type {
  Customer,
  Workspace,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerPagination,
} from '../types/customer';
import { canCreateCustomer, canEditCustomer, canArchiveCustomer } from '../types/customer';

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CustomersPage() {
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

  // Ref to prevent stale responses from overwriting current customer list
  const latestCustomerRequestId = useRef(0);

  // ── Customers state ────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<CustomerPagination>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Feedback alerts ────────────────────────────────────────────────────────
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Modal states ───────────────────────────────────────────────────────────
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string[]> | null>(null);

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
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
        // Match paramWorkspaceId if given, else default to first
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

  // ── Load customers for active workspace ────────────────────────────────────
  const loadCustomers = useCallback(
    async (page = 1) => {
      if (!activeWorkspace) return;
      const requestId = ++latestCustomerRequestId.current;
      setLoadingCustomers(true);
      setApiError(null);
      try {
        const token = await getIdToken();
        const data = await fetchCustomers(token, activeWorkspace.id, page, 20);
        if (requestId === latestCustomerRequestId.current) {
          setCustomers(data.customers);
          setPagination(data.pagination);
        }
      } catch (err: unknown) {
        if (requestId === latestCustomerRequestId.current) {
          setApiError(err instanceof Error ? err.message : 'Failed to load customers.');
        }
      } finally {
        if (requestId === latestCustomerRequestId.current) {
          setLoadingCustomers(false);
        }
      }
    },
    [activeWorkspace, getIdToken],
  );

  useEffect(() => {
    if (activeWorkspace) {
      void loadCustomers(1);
    } else {
      latestCustomerRequestId.current++;
      setCustomers([]);
    }
  }, [activeWorkspace, loadCustomers]);

  // ── Workspace switcher ─────────────────────────────────────────────────────
  const handleWorkspaceChange = (wsId: string) => {
    const selected = workspaces.find((w) => w.id === wsId);
    if (selected) {
      setActiveWorkspace(selected);
      void navigate(`/workspaces/${selected.id}/customers`);
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

  // ── Filtered Customers ─────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [customers, searchQuery]);

  // ── Permissions ────────────────────────────────────────────────────────────
  const role = activeWorkspace?.role ?? 'viewer';
  const canCreate = canCreateCustomer(role);
  const canEdit = canEditCustomer(role);
  const canArchive = canArchiveCustomer(role);

  // ── Add/Edit Submit ────────────────────────────────────────────────────────
  const handleFormSubmit = async (data: CreateCustomerInput | UpdateCustomerInput) => {
    if (!activeWorkspace) return;
    setIsSubmittingForm(true);
    setFormFieldErrors(null);
    setApiError(null);
    try {
      const token = await getIdToken();
      if (editingCustomer) {
        await updateCustomer(token, activeWorkspace.id, editingCustomer.id, data);
        setSuccessMessage(`Customer "${data.name ?? editingCustomer.name}" updated successfully.`);
      } else {
        const created = await createCustomer(
          token,
          activeWorkspace.id,
          data as CreateCustomerInput,
        );
        setSuccessMessage(`Customer "${created.name}" created successfully.`);
      }
      setFormModalOpen(false);
      setEditingCustomer(null);
      await loadCustomers(pagination.page);
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
      await archiveCustomer(token, activeWorkspace.id, archiveTarget.id);
      setSuccessMessage(`Customer "${archiveTarget.name}" archived successfully.`);
      setArchiveTarget(null);
      await loadCustomers(pagination.page);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to archive customer.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="app-container">
      <Navigation />

      <main className="main-content">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-titles">
            <h1>Customer Management</h1>
            <p className="header-subtitle">
              Manage accounts, contacts, and customer relationships with role-based access.
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingCustomer(null);
                setFormFieldErrors(null);
                setFormModalOpen(true);
              }}
            >
              + Add Customer
            </button>
          )}
        </div>

        {/* Global Feedback Banners */}
        {apiError && (
          <div className="alert alert-error" role="alert">
            <span>{apiError}</span>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => {
                setApiError(null);
              }}
              aria-label="Dismiss error"
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
              className="modal-close-btn"
              onClick={() => {
                setSuccessMessage(null);
              }}
              aria-label="Dismiss success"
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
                managing customers.
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

            {/* Controls Bar: Search + Filter */}
            <div className="controls-bar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search customers by name, email, or phone…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    void loadCustomers(pagination.page);
                  }}
                  disabled={loadingCustomers}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Customer Table / Content State */}
            {loadingCustomers ? (
              <div className="table-wrapper">
                <div className="state-container">
                  <div className="spinner" />
                  <p className="state-desc">Loading customer records…</p>
                </div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="table-wrapper">
                <div className="state-container">
                  <h3 className="state-title">
                    {searchQuery ? 'No Matching Customers' : 'No Customers Found'}
                  </h3>
                  <p className="state-desc">
                    {searchQuery
                      ? `No customers matched "${searchQuery}". Try a different search term or clear the filter.`
                      : 'There are no active customers in this workspace yet.'}
                  </p>
                  {searchQuery ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearchQuery('');
                      }}
                    >
                      Clear Search
                    </button>
                  ) : canCreate ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setEditingCustomer(null);
                        setFormFieldErrors(null);
                        setFormModalOpen(true);
                      }}
                    >
                      + Add First Customer
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((cust) => (
                      <tr key={cust.id}>
                        <td>
                          <span
                            className="customer-name"
                            onClick={() => {
                              setDetailCustomer(cust);
                            }}
                            title="Click to view details"
                          >
                            {cust.name}
                          </span>
                        </td>
                        <td>
                          {cust.email ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          {cust.phone ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>{new Date(cust.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setDetailCustomer(cust);
                              }}
                            >
                              View
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingCustomer(cust);
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
                                  setArchiveTarget(cust);
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
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.total > pagination.limit && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem',
                }}
              >
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Showing {filteredCustomers.length} of {pagination.total} customers (Page{' '}
                  {pagination.page})
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pagination.page <= 1 || loadingCustomers}
                    onClick={() => {
                      void loadCustomers(pagination.page - 1);
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={
                      pagination.page * pagination.limit >= pagination.total || loadingCustomers
                    }
                    onClick={() => {
                      void loadCustomers(pagination.page + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CustomerFormModal
        isOpen={formModalOpen}
        initialData={editingCustomer}
        onClose={() => {
          setFormModalOpen(false);
          setEditingCustomer(null);
          setFormFieldErrors(null);
        }}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmittingForm}
        apiErrors={formFieldErrors}
      />

      <CustomerDetailModal
        customer={detailCustomer}
        role={role}
        onClose={() => {
          setDetailCustomer(null);
        }}
        onEdit={(cust) => {
          setDetailCustomer(null);
          setEditingCustomer(cust);
          setFormFieldErrors(null);
          setFormModalOpen(true);
        }}
        onArchive={(cust) => {
          setDetailCustomer(null);
          setArchiveTarget(cust);
        }}
      />

      <ArchiveConfirmModal
        customer={archiveTarget}
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
