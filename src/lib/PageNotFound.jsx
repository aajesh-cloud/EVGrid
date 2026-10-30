import { Link, useLocation } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const pageName = location.pathname.substring(1);
  const homePath = isAuthenticated ? '/dashboard' : '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Compass className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <p className="mt-6 font-heading text-6xl font-bold tracking-tight text-emerald-900">404</p>
        <h1 className="mt-3 font-heading text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pageName ? (
            <>
              The page <span className="font-medium text-foreground">“{pageName}”</span> does not exist in EVGrid.
            </>
          ) : (
            'The page you were looking for does not exist in EVGrid.'
          )}
        </p>
        <Button asChild className="mt-6 rounded-xl bg-emerald-800 hover:bg-emerald-900">
          <Link to={homePath}>
            <Home className="mr-2 h-4 w-4" /> Go to {isAuthenticated ? 'dashboard' : 'home'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
