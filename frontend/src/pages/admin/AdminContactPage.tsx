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

const STATUS_BADGES: Record<ContactMessageStatus, string> = {
  NEW: 'badge-info',
  READ: 'badge-warning',
  REPLIED: 'badge-success',
  ARCHIVED: 'badge-neutral',
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
    <section className="space-y-6">
      <div>
        <p className="kicker">Boîte de réception</p>
        <h1 className="page-title">Messages de contact</h1>
        <p className="page-subtitle mt-1">
          Messages recus via le formulaire de contact.
        </p>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      {/* Filtres */}
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          className="input w-56"
        />
        <select
          value={query.status ?? ''}
          onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as ContactMessageQuery['status'], page: 1 })}
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="NEW">Nouveau</option>
          <option value="READ">Lu</option>
          <option value="REPLIED">Repondu</option>
          <option value="ARCHIVED">Archive</option>
        </select>
      </form>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Liste */}
        <div className="min-w-0 flex-1 space-y-4">
          {isPending ? (
            <p className="text-fg-muted">Chargement...</p>
          ) : messages.length === 0 ? (
            <p className="text-fg-muted">Aucun message.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDetailId(m.id)}
                  className={`card card-hover block w-full text-left ${
                    detailId === m.id ? 'border-edge-strong bg-surface' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`badge shrink-0 ${STATUS_BADGES[m.status]}`}>
                      {STATUS_LABELS[m.status]}
                    </span>
                    <span className="truncate font-semibold text-fg">{m.subject}</span>
                  </div>
                  <div className="mt-1 text-xs text-fg-muted">
                    {m.name} &lt;{m.email}&gt; — {formatDate(m.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuery({ ...query, page: p })}
                  className={`page-btn ${p === query.page ? 'page-btn-active' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="shrink-0 lg:w-96">
          {detailId && detailLoading && (
            <p className="text-fg-muted">Chargement du message...</p>
          )}
          {detailId && detail && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <span className={`badge ${STATUS_BADGES[detail.status]}`}>
                  {STATUS_LABELS[detail.status]}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="link"
                >
                  Fermer
                </button>
              </div>

              <h2 className="font-display text-lg font-bold text-fg">{detail.subject}</h2>

              <div className="space-y-1 text-sm">
                <p className="text-fg-secondary"><span className="text-fg-muted">De :</span> {detail.name}</p>
                <p className="text-fg-secondary"><span className="text-fg-muted">Email :</span> {detail.email}</p>
                {detail.user && (
                  <p className="text-fg-secondary"><span className="text-fg-muted">Utilisateur :</span> {detail.user.username}</p>
                )}
                {detail.ip && (
                  <p className="text-fg-secondary"><span className="text-fg-muted">IP :</span> {detail.ip}</p>
                )}
                <p className="text-fg-secondary"><span className="text-fg-muted">Date :</span> {formatDate(detail.created_at)}</p>
              </div>

              <div className="whitespace-pre-wrap rounded-sm bg-inset p-3 text-sm text-fg">
                {detail.message}
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.status !== 'READ' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'READ' })}
                    className="btn btn-sm btn-ghost text-warning"
                  >
                    Marquer lu
                  </button>
                )}
                {detail.status !== 'REPLIED' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'REPLIED' })}
                    className="btn btn-sm btn-ghost text-success"
                  >
                    Marquer repondu
                  </button>
                )}
                {detail.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: detail.id, status: 'ARCHIVED' })}
                    className="btn btn-sm btn-ghost"
                  >
                    Archiver
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { if (confirm('Supprimer ce message ?')) deleteMutation.mutate(detail.id); }}
                  className="btn btn-sm btn-danger"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
          {!detailId && (
            <p className="text-sm text-fg-muted">Selectionnez un message pour voir le detail.</p>
          )}
        </div>
      </div>
    </section>
  );
}