import { Link } from 'react-router-dom';

export default function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-accent font-display text-sm font-extrabold tracking-tight text-accent-contrast">
        SN
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-fg transition-colors group-hover:text-accent">
        Site News
      </span>
    </Link>
  );
}