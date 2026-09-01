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
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Contenu</p>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle mt-1">Gestion des categories de contenu.</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary">
          + Nouvelle
        </button>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      {isPending ? (
        <p className="text-fg-muted">Chargement...</p>
      ) : categories.length === 0 ? (
        <p className="text-fg-muted">Aucune categorie.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Slug</th>
                <th>Ordre</th>
                <th>Statut</th>
                <th>Articles</th>
                <th>Cree le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td className="mono">{c.slug}</td>
                  <td>{c.sort_order}</td>
                  <td>
                    <span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>{c.status}</span>
                  </td>
                  <td>{c.children_count}</td>
                  <td className="mono">{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex gap-x-3 gap-y-1 text-xs">
                      <button type="button" onClick={() => { setEditing(c); setShowForm(true); }}
                        className="cursor-pointer font-semibold text-accent hover:text-accent-strong">Modifier</button>
                      <button type="button" onClick={() => { if (confirm('Supprimer cette categorie ?')) deleteMutation.mutate(c.id); }}
                        className="cursor-pointer font-semibold text-danger hover:underline">Supprimer</button>
                    </div>
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
    <div className="modal-overlay">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, sort_order: sortOrder, status }); }}
        className="modal-panel max-w-md">
        <h2 className="mb-4 font-display text-lg font-bold text-fg">{editing ? 'Modifier' : 'Nouvelle categorie'}</h2>
        <div className="space-y-3">
          <input type="text" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required className="input w-full" />
          <input type="number" placeholder="Ordre" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} min={0} className="input w-full" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
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