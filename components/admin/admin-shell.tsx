'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from './admin-sidebar';
import { AdminHeader } from './admin-header';
import { cn } from '@/lib/utils';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main id="main-content" tabIndex={-1} className="min-h-screen outline-none">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen overflow-hidden">
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out'
          )}
        >
          <AdminHeader onMenuClick={() => setSidebarOpen((prev) => !prev)} />
          <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-10 outline-none">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              {children}
            </div>
          </main>
        </div>

        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
