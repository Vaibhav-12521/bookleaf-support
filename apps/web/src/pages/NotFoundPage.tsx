import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        title="Page not found"
        body="The page you're looking for doesn't exist or you don't have access to it."
        action={
          <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
            Go to your dashboard
          </Link>
        }
      />
    </div>
  );
}
