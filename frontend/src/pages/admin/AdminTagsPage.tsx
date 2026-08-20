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
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-amber-400">Tags</h1>
        <p className="mt-1 text-sm text-slate-400">Gestion des tags de contenu.</p>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate({ name: newName.trim() }); }}
        className="mb-6 flex gap-3">
        <input type="text" placeholder="Nouveau tag" value={newName} onChange={(e) => setNewName(e.target.value)} required
          className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        <button type="submit" disabled={createMutation.isPending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
          {createMutation.isPending ? '...' : 'Ajouter'}
        </button>
      </form>

      {isPending ? <p className="text-slate-400">Chargement...</p> : tags.length === 0 ? (
        <p className="text-slate-400">Aucun tag.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Articles</th>
                <th className="px-3 py-2">Cree le</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-100">{t.name}</td>
                  <td className="px-3 py-2 text-slate-300">{t.slug}</td>
                  <td className="px-3 py-2 text-slate-300">{t.articles_count}</td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(t.created_at)}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { if (confirm('Supprimer ce tag ?')) deleteMutation.mutate(t.id); }}
                      className="text-xs text-red-400 hover:underline">Supprimer</button>
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
