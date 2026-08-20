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
    return <section className="mx-auto max-w-3xl px-4 py-8"><p className="text-slate-400">Chargement...</p></section>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-amber-400">{isEditing ? 'Modifier l\'article' : 'Nouvel article'}</h1>

      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="article-title" className="mb-1 block text-sm text-slate-300">Titre *</label>
          <input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label htmlFor="article-summary" className="mb-1 block text-sm text-slate-300">Resume</label>
          <textarea id="article-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label htmlFor="article-content" className="mb-1 block text-sm text-slate-300">Contenu * (HTML)</label>
          <textarea id="article-content" value={content} onChange={(e) => setContent(e.target.value)} required rows={12}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="article-category" className="mb-1 block text-sm text-slate-300">Categorie</label>
            <select id="article-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="">Aucune</option>
              {categories?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="article-language" className="mb-1 block text-sm text-slate-300">Langue</label>
            <select id="article-language" value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="fr">Francais</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tagsData?.data.map((t) => (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className={`rounded px-3 py-1 text-xs ${selectedTags.includes(t.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {t.name}
              </button>
            ))}
            {tagsData?.data.length === 0 && <span className="text-xs text-slate-500">Aucun tag disponible</span>}
          </div>
        </div>

        <div>
          <label htmlFor="article-source" className="mb-1 block text-sm text-slate-300">Source (URL)</label>
          <input id="article-source" value={source} onChange={(e) => setSource(e.target.value)} type="url" placeholder="https://..."
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label htmlFor="article-status" className="mb-1 block text-sm text-slate-300">Statut</label>
          <select id="article-status" value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publie</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/admin/articles')}
            className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Annuler</button>
          <button type="submit" disabled={isPending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
            {isPending ? 'Envoi...' : isEditing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </section>
  );
}
