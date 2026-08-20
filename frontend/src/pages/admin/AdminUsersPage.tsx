import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser, setUserStatus, resetPassword } from '../../services/admin.service.ts';
import type { UserAdminQuery, CreateUserInput } from '../../types/admin.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<UserAdminQuery>({ page: 1, pageSize: 20 });
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; username: string; email: string; first_name: string | null; last_name: string | null; role: 'USER' | 'ADMIN' } | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
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
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-400">Gestion des comptes utilisateurs.</p>
        </div>
        <button type="button" onClick={() => { setEditingUser(null); setShowForm(true); setError(null); setNotice(null); }}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400">
          + Nouveau
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher..." value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        <select value={query.role ?? ''} onChange={(e) => setQuery({ ...query, role: (e.target.value || undefined) as 'USER' | 'ADMIN', page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <option value="">Tous les roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={query.status ?? ''} onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as 'ACTIVE' | 'DISABLED', page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="DISABLED">Desactive</option>
        </select>
      </form>

      {isPending ? <p className="text-slate-400">Chargement...</p> : users.length === 0 ? (
        <p className="text-slate-400">Aucun utilisateur.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Derniere connexion</th>
                <th className="px-3 py-2">Cree le</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-100">{u.username}</td>
                  <td className="px-3 py-2 text-slate-300">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>{u.role}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${u.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{u.status}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(u.last_login_at)}</td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setEditingUser(u); setShowForm(true); }}
                        className="text-xs text-amber-400 hover:underline">Modifier</button>
                      <button type="button" onClick={() => statusMutation.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                        className={`text-xs hover:underline ${u.status === 'ACTIVE' ? 'text-orange-400' : 'text-green-400'}`}>
                        {u.status === 'ACTIVE' ? 'Desactiver' : 'Activer'}
                      </button>
                      <button type="button" onClick={() => setResetId(resetId === u.id ? null : u.id)}
                        className="text-xs text-blue-400 hover:underline">Reset MDP</button>
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
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setQuery({ ...query, page: p })}
              className={`rounded px-3 py-1 text-sm ${p === query.page ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{p}</button>
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
    </section>
  );
}

function ResetPasswordForm({ onSubmit, onCancel, isPending }: { onSubmit: (p: string) => void; onCancel: () => void; isPending: boolean }) {
  const [password, setPassword] = useState('');
  return (
    <div className="mt-2 flex items-center gap-2">
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau MDP (8+ chars)" minLength={8}
        className="w-48 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100" />
      <button type="button" disabled={isPending || password.length < 8} onClick={() => onSubmit(password)}
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50">OK</button>
      <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">Annuler</button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-amber-400">{editing ? 'Modifier' : 'Nouvel utilisateur'}</h2>
        <div className="space-y-3">
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32}
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          <div className="flex gap-3">
            <input type="text" placeholder="Prenom" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
            <input type="text" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {!editing && (
            <input type="password" placeholder="Mot de passe (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
          <button type="submit" disabled={isPending} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
            {isPending ? 'Envoi...' : editing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  );
}
