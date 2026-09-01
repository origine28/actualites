import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getAdminArticle, createArticle, updateArticle, listCategoriesAdmin, listTagsAdmin } from '../../services/content.service.ts';
import type { CreateArticleInput } from '../../types/content.ts';
import { getApiErrorMessage } from '../../utils/error.ts';

export default function AdminArticleEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [language, setLanguage] = useState('fr');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [error, setError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['admin-article', id],
    queryFn: () => getAdminArticle(id!),
    enabled: isEditing,
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => listCategoriesAdmin(),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => listTagsAdmin({ pageSize: 100 }),
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSummary(existing.summary ?? '');
      setContent(existing.content);
      setCategoryId(existing.category?.id ?? '');
      setSelectedTags(existing.tags.map((t) => t.id));
      setSource(existing.source ?? '');
      setLanguage(existing.language);
      setStatus(existing.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
    }
  }, [existing]);

  const createMutation = useMutation({
    mutationFn: (input: CreateArticleInput) => createArticle(input),
    onSuccess: () => navigate('/admin/articles'),
    onError: (err: unknown) => setError(getApiErrorMessage(err, 'Erreur lors de la creation')),
  });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateArticle>[1]) => updateArticle(id!, input),
    onSuccess: () => navigate('/admin/articles'),
    onError: (err: unknown) => setError(getApiErrorMessage(err, 'Erreur lors de la mise a jour')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      title, summary: summary || null, content,
      category_id: categoryId || null,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      source: source || null, language, status,
    };
    if (isEditing) updateMutation.mutate(input);
    else createMutation.mutate(input);
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && loadingExisting) {
    return <section className="mx-auto max-w-3xl px-4 py-8"><p className="text-fg-muted">Chargement...</p></section>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="kicker">Contenu</p>
        <h1 className="page-title">{isEditing ? "Modifier l'article" : 'Nouvel article'}</h1>
      </div>

      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="field">
          <label htmlFor="article-title" className="field-label">Titre *</label>
          <input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200}
            className="input w-full" />
        </div>

        <div className="field">
          <label htmlFor="article-summary" className="field-label">Resume</label>
          <textarea id="article-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={500}
            className="input w-full" />
        </div>

        <div className="field">
          <label htmlFor="article-content" className="field-label">Contenu * (HTML)</label>
          <textarea id="article-content" value={content} onChange={(e) => setContent(e.target.value)} required rows={12}
            className="input input-mono w-full" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label htmlFor="article-category" className="field-label">Categorie</label>
            <select id="article-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
              <option value="">Aucune</option>
              {categories?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="article-language" className="field-label">Langue</label>
            <select id="article-language" value={language} onChange={(e) => setLanguage(e.target.value)} className="input w-full">
              <option value="fr">Francais</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Tags</span>
          <div className="flex flex-wrap gap-2">
            {tagsData?.data.map((t) => (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className={`badge cursor-pointer ${selectedTags.includes(t.id) ? 'badge-accent' : 'badge-neutral'}`}>
                {t.name}
              </button>
            ))}
            {tagsData?.data.length === 0 && <span className="text-xs text-fg-muted">Aucun tag disponible</span>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="article-source" className="field-label">Source (URL)</label>
          <input id="article-source" value={source} onChange={(e) => setSource(e.target.value)} type="url" placeholder="https://..."
            className="input w-full" />
        </div>

        <div className="field">
          <label htmlFor="article-status" className="field-label">Statut</label>
          <select id="article-status" value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="input w-full">
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publie</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/admin/articles')} className="btn btn-ghost">Annuler</button>
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? 'Envoi...' : isEditing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </section>
  );
}