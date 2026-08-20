import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '../../services/content.service.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; slug: string; sort_order: number; status: string } | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-categories-list'],
    queryFn: () => listCategoriesAdmin(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories-list'] });

  const createMutation = useMutation({
    mutationFn: (input: { name: string }) => createCategory(input),
    onSuccess: () => { invalidate(); setShowForm(false); setNotice('Categorie creee.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur')); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCategory>[1] }) => updateCategory(id, input),
    onSuccess: () => { invalidate(); setEditing(null); setNotice('Categorie mise a jour.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur')); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => { invalidate(); setNotice('Categorie supprimee.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Suppression impossible')); },
  });

  const categories = data?.data ?? [];

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Categories</h1>
          <p className="mt-1 text-sm text-slate-400">Gestion des categories de contenu.</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400">
          + Nouvelle
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      {isPending ? <p className="text-slate-400">Chargement...</p> : categories.length === 0 ? (
        <p className="text-slate-400">Aucune categorie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Ordre</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Articles</th>
                <th className="px-3 py-2">Cree le</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-100">{c.name}</td>
                  <td className="px-3 py-2 text-slate-300">{c.slug}</td>
                  <td className="px-3 py-2 text-slate-300">{c.sort_order}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${c.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' : 'bg-slate-600 text-slate-400'}`}>{c.status}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{c.children_count}</td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(c.created_at)}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button type="button" onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs text-amber-400 hover:underline">Modifier</button>
                    <button type="button" onClick={() => { if (confirm('Supprimer cette categorie ?')) deleteMutation.mutate(c.id); }} className="text-xs text-red-400 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CategoryForm
          editing={editing}
          onSubmit={(input) => {
            if (editing) updateMutation.mutate({ id: editing.id, input });
            else createMutation.mutate(input as { name: string });
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </section>
  );
}

function CategoryForm({ editing, onSubmit, onClose, isPending }: {
  editing: { id: string; name: string; slug: string; sort_order: number; status: string } | null;
  onSubmit: (input: Record<string, unknown>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? 0);
  const [status, setStatus] = useState(editing?.status ?? 'ACTIVE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, sort_order: sortOrder, status }); }}
        className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-amber-400">{editing ? 'Modifier' : 'Nouvelle categorie'}</h2>
        <div className="space-y-3">
          <input type="text" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          <input type="number" placeholder="Ordre" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} min={0}
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
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
