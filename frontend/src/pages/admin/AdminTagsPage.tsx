import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTagsAdmin, createTag, deleteTag } from '../../services/content.service.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin-tags-list'],
    queryFn: () => listTagsAdmin({ pageSize: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tags-list'] });

  const createMutation = useMutation({
    mutationFn: (input: { name: string }) => createTag(input),
    onSuccess: () => { invalidate(); setNewName(''); setNotice('Tag cree.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur')); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => { invalidate(); setNotice('Tag supprime.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Suppression impossible')); },
  });

  const tags = data?.data ?? [];

  return (
    <section className="space-y-6">
      <div>
        <p className="kicker">Contenu</p>
        <h1 className="page-title">Tags</h1>
        <p className="page-subtitle mt-1">Gestion des tags de contenu.</p>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate({ name: newName.trim() }); }}
        className="flex max-w-md gap-3">
        <input type="text" placeholder="Nouveau tag" value={newName} onChange={(e) => setNewName(e.target.value)} required className="input flex-1" />
        <button type="submit" disabled={createMutation.isPending} className="btn btn-primary">
          {createMutation.isPending ? '...' : 'Ajouter'}
        </button>
      </form>

      {isPending ? (
        <p className="text-fg-muted">Chargement...</p>
      ) : tags.length === 0 ? (
        <p className="text-fg-muted">Aucun tag.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Slug</th>
                <th>Articles</th>
                <th>Cree le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td className="mono">{t.slug}</td>
                  <td>{t.articles_count}</td>
                  <td className="mono">{formatDate(t.created_at)}</td>
                  <td>
                    <button type="button" onClick={() => { if (confirm('Supprimer ce tag ?')) deleteMutation.mutate(t.id); }}
                      className="cursor-pointer text-xs font-semibold text-danger hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}