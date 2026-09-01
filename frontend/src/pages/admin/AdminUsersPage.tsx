import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser, setUserStatus, resetPassword, getUserLoginHistory } from '../../services/admin.service.ts';
import type { UserAdminQuery, CreateUserInput, LoginHistoryEntry, LoginHistoryQuery } from '../../types/admin.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<UserAdminQuery>({ page: 1, pageSize: 20 });
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; username: string; email: string; first_name: string | null; last_name: string | null; role: 'USER' | 'ADMIN' } | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [loginUser, setLoginUser] = useState<{ id: string; username: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => listUsers(query),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => { invalidate(); setShowForm(false); setNotice('Utilisateur cree.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur lors de la creation')); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateUser>[1] }) => updateUser(id, input),
    onSuccess: () => { invalidate(); setEditingUser(null); setNotice('Utilisateur mis a jour.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur lors de la mise a jour')); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'DISABLED' }) => setUserStatus(id, status),
    onSuccess: () => { invalidate(); setNotice('Statut mis a jour.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur de statut')); },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetPassword(id, password),
    onSuccess: () => { setResetId(null); setNotice('Mot de passe reinitialise.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur de reinitialisation')); },
  });

  const users = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Équipe</p>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle mt-1">Gestion des comptes utilisateurs.</p>
        </div>
        <button type="button" onClick={() => { setEditingUser(null); setShowForm(true); setError(null); setNotice(null); }} className="btn btn-primary">
          + Nouveau
        </button>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Rechercher..." value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: 1 })}
          className="input w-56" />
        <select value={query.role ?? ''} onChange={(e) => setQuery({ ...query, role: (e.target.value || undefined) as 'USER' | 'ADMIN', page: 1 })}
          className="input w-auto">
          <option value="">Tous les roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={query.status ?? ''} onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as 'ACTIVE' | 'DISABLED', page: 1 })}
          className="input w-auto">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="DISABLED">Desactive</option>
        </select>
      </form>

      {isPending ? (
        <p className="text-fg-muted">Chargement...</p>
      ) : users.length === 0 ? (
        <p className="text-fg-muted">Aucun utilisateur.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Statut</th>
                <th>Derniere connexion</th>
                <th>Cree le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-accent' : 'badge-neutral'}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{u.status}</span>
                  </td>
                  <td className="mono">{formatDate(u.last_login_at)}</td>
                  <td className="mono">{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <button type="button" onClick={() => { setEditingUser(u); setShowForm(true); }}
                        className="cursor-pointer font-semibold text-accent hover:text-accent-strong">Modifier</button>
                      <button type="button" onClick={() => statusMutation.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                        className={`cursor-pointer font-semibold hover:underline ${u.status === 'ACTIVE' ? 'text-warning' : 'text-success'}`}>
                        {u.status === 'ACTIVE' ? 'Desactiver' : 'Activer'}
                      </button>
                      <button type="button" onClick={() => setResetId(resetId === u.id ? null : u.id)}
                        className="cursor-pointer font-semibold text-info hover:underline">Reset MDP</button>
                      <button type="button" onClick={() => setLoginUser({ id: u.id, username: u.username })}
                        className="cursor-pointer font-semibold text-accent hover:underline">Connexions</button>
                    </div>
                    {resetId === u.id && (
                      <ResetPasswordForm
                        onSubmit={(password) => resetMutation.mutate({ id: u.id, password })}
                        onCancel={() => setResetId(null)}
                        isPending={resetMutation.isPending}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setQuery({ ...query, page: p })}
              className={`page-btn ${p === query.page ? 'page-btn-active' : ''}`}>{p}</button>
          ))}
        </div>
      )}

      {showForm && (
        <UserForm
          editing={editingUser}
          onSubmit={(input) => {
            if (editingUser) {
              updateMutation.mutate({ id: editingUser.id, input: { username: input.username, email: input.email, firstName: input.firstName, lastName: input.lastName, role: input.role } });
            } else {
              createMutation.mutate(input as CreateUserInput);
            }
          }}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {loginUser && (
        <LoginHistoryModal
          userId={loginUser.id}
          username={loginUser.username}
          onClose={() => setLoginUser(null)}
        />
      )}
    </section>
  );
}

function ResetPasswordForm({ onSubmit, onCancel, isPending }: { onSubmit: (p: string) => void; onCancel: () => void; isPending: boolean }) {
  const [password, setPassword] = useState('');
  return (
    <div className="mt-2 flex items-center gap-2">
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau MDP (8+ chars)" minLength={8}
        className="input input-mono w-48 px-2 py-1 text-xs" />
      <button type="button" disabled={isPending || password.length < 8} onClick={() => onSubmit(password)}
        className="btn btn-sm">OK</button>
      <button type="button" onClick={onCancel} className="link">Annuler</button>
    </div>
  );
}

function resultLabel(result: LoginHistoryEntry['result']): string {
  switch (result) {
    case 'SUCCESS': return 'Connexion';
    case 'FAILURE': return 'Echec';
    case 'LOGOUT': return 'Deconnexion';
    default: return result;
  }
}

function resultBadge(result: LoginHistoryEntry['result']): string {
  switch (result) {
    case 'SUCCESS': return 'badge-success';
    case 'FAILURE': return 'badge-danger';
    case 'LOGOUT': return 'badge-neutral';
    default: return 'badge-neutral';
  }
}

type LoginHistoryPageQuery = Omit<LoginHistoryQuery, 'page'> & { page: number };

function LoginHistoryModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const [query, setQuery] = useState<LoginHistoryPageQuery>({ page: 1, pageSize: 10 });

  const { data, isPending, isError } = useQuery({
    queryKey: ['admin-user-login-history', userId, query],
    queryFn: () => getUserLoginHistory(userId, query),
    enabled: !!userId,
  });

  const entries = data?.data ?? [];
  const pagination = data?.pagination;
  const latest = entries[0];

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">Connexions de {username}</h2>
            <p className="mt-1 text-sm text-fg-muted">Historique des connexions, horaires, adresses IP et ports source.</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer">
            &times;
          </button>
        </div>

        {isPending ? (
          <p className="text-fg-muted">Chargement...</p>
        ) : isError ? (
          <p className="alert alert-error">Impossible de charger l'historique de connexion.</p>
        ) : entries.length === 0 ? (
          <p className="text-fg-muted">Aucune connexion enregistree pour cet utilisateur.</p>
        ) : (
          <>
            <div className="card mb-4">
              <h3 className="mb-2 text-sm font-semibold text-fg">Derniere connexion</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-fg-muted">Horaire</dt>
                  <dd className="text-fg">{formatDate(latest.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Adresse IP publique</dt>
                  <dd className="mono font-mono text-fg">{latest.ip ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Port source</dt>
                  <dd className="mono font-mono text-fg">{latest.source_port ?? 'Non disponible'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Resultat</dt>
                  <dd><span className={`badge ${resultBadge(latest.result)}`}>{resultLabel(latest.result)}</span></dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Acces</dt>
                  <dd className="text-fg">{latest.access_type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Navigateur</dt>
                  <dd className="truncate text-fg" title={latest.user_agent ?? ''}>{latest.user_agent ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Horaire</th>
                    <th>IP publique</th>
                    <th>Port</th>
                    <th>Resultat</th>
                    <th>Acces</th>
                    <th>Navigateur</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.created_at)}</td>
                      <td className="mono">{e.ip ?? '—'}</td>
                      <td className="mono">{e.source_port ?? 'N/A'}</td>
                      <td><span className={`badge ${resultBadge(e.result)}`}>{resultLabel(e.result)}</span></td>
                      <td>{e.access_type}</td>
                      <td className="max-w-[12rem] truncate" title={e.user_agent ?? ''}>{e.user_agent ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-fg-muted">{pagination.total} connexion(s)</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}
                    className={`page-btn ${query.page <= 1 ? 'page-btn-disabled' : ''}`}>
                    Precedent
                  </button>
                  <span className="px-2 py-1 text-xs text-fg-secondary">Page {query.page} / {pagination.totalPages}</span>
                  <button type="button" disabled={query.page >= pagination.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}
                    className={`page-btn ${query.page >= pagination.totalPages ? 'page-btn-disabled' : ''}`}>
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UserForm({ editing, onSubmit, onClose, isPending }: {
  editing: { id: string; username: string; email: string; first_name: string | null; last_name: string | null; role: 'USER' | 'ADMIN' } | null;
  onSubmit: (input: { username: string; email: string; password?: string; firstName: string | null; lastName: string | null; role: 'USER' | 'ADMIN' }) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [username, setUsername] = useState(editing?.username ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [firstName, setFirstName] = useState(editing?.first_name ?? '');
  const [lastName, setLastName] = useState(editing?.last_name ?? '');
  const [role, setRole] = useState<'USER' | 'ADMIN'>(editing?.role ?? 'USER');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      onSubmit({ username, email, firstName: firstName || null, lastName: lastName || null, role });
    } else {
      onSubmit({ username, email, password, firstName: firstName || null, lastName: lastName || null, role });
    }
  }

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="modal-panel">
        <h2 className="mb-4 font-display text-lg font-bold text-fg">{editing ? 'Modifier' : 'Nouvel utilisateur'}</h2>
        <div className="space-y-3">
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} className="input" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
          <div className="flex gap-3">
            <input type="text" placeholder="Prenom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input flex-1" />
            <input type="text" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input flex-1" />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')} className="input w-full">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {!editing && (
            <input type="password" placeholder="Mot de passe (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input w-full" />
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? 'Envoi...' : editing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  );
}