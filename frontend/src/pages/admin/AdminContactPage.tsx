import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listContactMessages,
  getContactMessage,
  setContactMessageStatus,
  deleteContactMessage,
} from '../../services/contact.service.ts';
import type { ContactMessageQuery, ContactMessageStatus } from '../../types/contact.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

const STATUS_COLORS: Record<ContactMessageStatus, string> = {
  NEW: 'bg-blue-500/20 text-blue-300',
  READ: 'bg-yellow-500/20 text-yellow-300',
  REPLIED: 'bg-green-500/20 text-green-300',
  ARCHIVED: 'bg-slate-500/20 text-slate-400',
};

const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  NEW: 'Nouveau',
  READ: 'Lu',
  REPLIED: 'Repondu',
  ARCHIVED: 'Archive',
};

export default function AdminContactPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<ContactMessageQuery>({ page: 1, pageSize: 20 });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-contact-messages', query],
    queryFn: () => listContactMessages(query),
  });

  const { data: detail, isPending: detailLoading } = useQuery({
    queryKey: ['admin-contact-message', detailId],
    queryFn: () => getContactMessage(detailId!),
    enabled: !!detailId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-contact-message'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setContactMessageStatus(id, status),
    onSuccess: () => {
      invalidate();
      setNotice('Statut mis a jour.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Erreur de statut'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContactMessage(id),
    onSuccess: () => {
      invalidate();
      setDetailId(null);
      setNotice('Message supprime.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Suppression impossible'));
    },
  });

  const messages = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-amber-400">Messages de contact</h1>
        <p className="mt-1 text-sm text-slate-400">
          Messages recus via le formulaire de contact.
        </p>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      {/* Filtres */}
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        />
        <select
          value={query.status ?? ''}
          onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as ContactMessageQuery['status'], page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Tous les statuts</option>
          <option value="NEW">Nouveau</option>
          <option value="READ">Lu</option>
          <option value="REPLIED">Repondu</option>
          <option value="ARCHIVED">Archive</option>
        </select>
      </form>

      <div className="flex gap-6">
        {/* Liste */}
        <div className="flex-1">
          {isPending ? (
            <p className="text-slate-400">Chargement...</p>
          ) : messages.length === 0 ? (
            <p className="text-slate-400">Aucun message.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDetailId(m.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    detailId === m.id
                      ? 'border-amber-500/50 bg-slate-800'
                      : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[m.status]}`}>
                          {STATUS_LABELS[m.status]}
                        </span>
                        <span className="truncate font-medium text-slate-100">{m.subject}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {m.name} &lt;{m.email}&gt; — {formatDate(m.created_at)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuery({ ...query, page: p })}
                  className={`rounded px-3 py-1 text-sm ${p === query.page ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="w-96 shrink-0">
          {detailId && detailLoading && (
            <p className="text-slate-400">Chargement du message...</p>
          )}
          {detailId && detail && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[detail.status]}`}>
                  {STATUS_LABELS[detail.status]}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Fermer
                </button>
              </div>

              <h2 className="mb-3 text-lg font-bold text-slate-100">{detail.subject}</h2>

              <div className="mb-3 space-y-1 text-sm text-slate-400">
                <p><span className="text-slate-500">De :</span> {detail.name}</p>
                <p><span className="text-slate-500">Email :</span> {detail.email}</p>
                {detail.user && (
                  <p><span className="text-slate-500">Utilisateur :</span> {detail.user.username}</p>
                )}
                {detail.ip && (
                  <p><span className="text-slate-500">IP :</span> {detail.ip}</p>
                )}
                <p><span className="text-slate-500">Date :</span> {formatDate(detail.created_at)}</p>
              </div>

              <div className="mb-4 whitespace-pre-wrap rounded bg-slate-900 p-3 text-sm text-slate-200">
                {detail.message}
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.status !== 'READ' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'READ' })}
                    className="rounded bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30"
                  >
                    Marquer lu
                  </button>
                )}
                {detail.status !== 'REPLIED' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'REPLIED' })}
                    className="rounded bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30"
                  >
                    Marquer repondu
                  </button>
                )}
                {detail.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'ARCHIVED' })}
                    className="rounded bg-slate-500/20 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-500/30"
                  >
                    Archiver
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { if (confirm('Supprimer ce message ?')) deleteMutation.mutate(detail.id); }}
                  className="rounded bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
          {!detailId && (
            <p className="text-sm text-slate-500">Selectionnez un message pour voir le detail.</p>
          )}
        </div>
      </div>
    </section>
  );
}
