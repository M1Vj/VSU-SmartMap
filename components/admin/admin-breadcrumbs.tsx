'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.reduce<{ href: string; label: string }[]>((acc, segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = segment === 'admin' ? 'Admin' : segment.replace(/-/g, ' ');
    acc.push({ href, label });
    return acc;
  }, []);

  if (!crumbs.length) return null;

  return (
    <nav className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-2">
            {isLast ? (
              <span className="capitalize rounded-full bg-card px-3 py-1 font-medium text-foreground shadow-sm">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="capitalize rounded-full bg-card px-3 py-1 shadow-sm transition hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight className="h-4 w-4 text-muted-foreground/80" />}
          </span>
        );
      })}
    </nav>
  );
}
