import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendContactMessage } from '../services/contact.service.ts';
import type { CreateContactMessageInput } from '../types/contact.ts';
import { getApiErrorMessage } from '../utils/error.ts';

export default function ContactPage() {
  const [form, setForm] = useState<CreateContactMessageInput>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateContactMessageInput) => sendContactMessage(input),
    onSuccess: () => {
      setNotice('Message envoye avec succes.');
      setError(null);
      setForm({ name: '', email: '', subject: '', message: '' });
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, "Erreur lors de l'envoi"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    mutation.mutate(form);
  }

  function updateField(field: keyof CreateContactMessageInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">Contact</h1>
      <p className="mb-6 text-slate-400">Envoyez-nous un message.</p>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm text-slate-400">Nom</label>
          <input
            id="contact-name"
            type="text"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Votre nom"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm text-slate-400">Email</label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={255}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="votre@email.fr"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1 block text-sm text-slate-400">Sujet</label>
          <input
            id="contact-subject"
            type="text"
            required
            maxLength={200}
            value={form.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            placeholder="Sujet du message"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1 block text-sm text-slate-400">Message</label>
          <textarea
            id="contact-message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={form.message}
            onChange={(e) => updateField('message', e.target.value)}
            placeholder="Votre message (10 caracteres minimum)"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-amber-500 px-6 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
          {mutation.isPending ? 'Envoi...' : 'Envoyer'}
        </button>
      </form>
    </section>
  );
}
