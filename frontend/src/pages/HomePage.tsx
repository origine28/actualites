import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getHealth } from '../services/api.ts';

export default function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-100">
      <h1 className="text-3xl font-bold">SITE NEWS</h1>
      <p className="text-slate-400">Plateforme d'actualites</p>

      {isPending && <p className="text-slate-400">Verification du backend...</p>}
      {isError && <p className="text-red-400">Backend injoignable — /api/health</p>}
      {data && (
        <p className="rounded bg-slate-800 px-4 py-2 text-emerald-400">
          Backend : {data.status}
        </p>
      )}

      <Link
        to="/login"
        className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500"
      >
        Connexion
      </Link>
    </main>
  );
}
