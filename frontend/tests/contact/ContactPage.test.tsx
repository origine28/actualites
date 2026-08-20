import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContactPage from '../../src/pages/ContactPage.tsx';

const sendContactMessage = vi.fn();

vi.mock('../../src/services/contact.service.ts', () => ({
  sendContactMessage: (...args: unknown[]) => sendContactMessage(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rendu : affiche le formulaire', () => {
    renderPage();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Sujet')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });

  it('validation : les champs obligatoires sont requis', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it('saisie et envoi', async () => {
    sendContactMessage.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Nom'), 'Jean Dupont');
    await userEvent.type(screen.getByLabelText('Email'), 'jean@example.fr');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Question');
    await userEvent.type(screen.getByLabelText('Message'), 'Bonjour, jai une question importante.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(sendContactMessage).toHaveBeenCalledWith({
      name: 'Jean Dupont',
      email: 'jean@example.fr',
      subject: 'Question',
      message: 'Bonjour, jai une question importante.',
    }));
  });

  it('loading : le bouton est desactive pendant l\'envoi', async () => {
    let resolve: () => void;
    sendContactMessage.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    renderPage();

    await userEvent.type(screen.getByLabelText('Nom'), 'Jean');
    await userEvent.type(screen.getByLabelText('Email'), 'jean@example.fr');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Test');
    await userEvent.type(screen.getByLabelText('Message'), 'Message de test suffisamment long.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Envoi...' })).toBeDisabled());
    resolve!();
  });

  it('succes : affiche le message de succes et reset le formulaire', async () => {
    sendContactMessage.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Nom'), 'Jean');
    await userEvent.type(screen.getByLabelText('Email'), 'jean@example.fr');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Test');
    await userEvent.type(screen.getByLabelText('Message'), 'Message de test suffisamment long.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText(/Message envoye/)).toBeInTheDocument();
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('');
  });

  it('erreur : affiche le message d\'erreur', async () => {
    sendContactMessage.mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { error: { code: 'RATE_LIMITED', message: 'Trop de messages.' } } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('Nom'), 'Jean');
    await userEvent.type(screen.getByLabelText('Email'), 'jean@example.fr');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Test');
    await userEvent.type(screen.getByLabelText('Message'), 'Message de test suffisamment long.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Trop de messages.')).toBeInTheDocument();
  });

  it('401 : gere la deconnexion', async () => {
    sendContactMessage.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' } } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('Nom'), 'Jean');
    await userEvent.type(screen.getByLabelText('Email'), 'jean@example.fr');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Test');
    await userEvent.type(screen.getByLabelText('Message'), 'Message de test suffisamment long.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Authentification requise')).toBeInTheDocument();
  });
});
