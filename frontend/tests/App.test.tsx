import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/App.tsx';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App (smoke test)', () => {
  it('rend le titre de la page d accueil', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SITE NEWS');
  });
});
