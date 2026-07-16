'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Menu, LogOut } from 'lucide-react';
import { HelpGuideButton } from '@/components/help/help-guide-dialog';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  return (
    <header className="sticky top-0 z-[95] border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline text-foreground font-semibold">Admin</span>
          <span className="hidden sm:inline text-muted-foreground/40">/</span>
          <span>SmartMap Control Center</span>
        </div>

        <div className="flex-1" />

        <HelpGuideButton
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          showLabel={false}
        />

        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" aria-hidden />
          Logout
        </Button>
      </div>
    </header>
  );
}
