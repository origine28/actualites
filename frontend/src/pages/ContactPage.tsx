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
    <section className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="kicker">La rédaction</p>
        <h1 className="page-title-lg">Contact</h1>
        <p className="page-subtitle mt-1">Envoyez-nous un message.</p>
      </header>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="field">
          <label htmlFor="contact-name" className="field-label">Nom</label>
          <input
            id="contact-name"
            type="text"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Votre nom"
            className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="contact-email" className="field-label">Email</label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={255}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="votre@email.fr"
            className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="contact-subject" className="field-label">Sujet</label>
          <input
            id="contact-subject"
            type="text"
            required
            maxLength={200}
            value={form.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            placeholder="Sujet du message"
            className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="contact-message" className="field-label">Message</label>
          <textarea
            id="contact-message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={form.message}
            onChange={(e) => updateField('message', e.target.value)}
            placeholder="Votre message (10 caracteres minimum)"
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn btn-primary"
        >
          {mutation.isPending ? 'Envoi...' : 'Envoyer'}
        </button>
      </form>
    </section>
  );
}