'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building, Lightbulb, Bug, Info, Map, Globe, Route, Calendar, Brain, Home, Bell, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMapStyle } from '@/lib/context/map-style-context';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/facilities', label: 'Facilities', icon: Building },
  { href: '/admin/boarding-houses', label: 'Boarding Houses', icon: Home },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/navigation', label: 'Navigation', icon: Route },
  { href: '/admin/ai-knowledge', label: 'AI Knowledge', icon: Brain },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/suggestions', label: 'Suggestions', icon: Lightbulb },
  { href: '/admin/bugs', label: 'Bug Reports', icon: Bug },
  { href: '/admin/logs', label: 'Logs', icon: Activity },
  { href: '/info', label: 'Project Info', icon: Info },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarContent({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const { mapStyle, setMapStyle } = useMapStyle();

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      {/* Brand Section */}
      <div className="flex items-center px-6 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/icons/icon-192x192.png?v=20260709"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-lg"
            unoptimized
            priority
          />
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-lg font-bold tracking-tight">SmartMap</h1>
            <p className="text-xs font-medium text-muted-foreground">Admin Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-2 px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Main Menu</p>
        </div>
        <nav className="space-y-2" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-border p-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium text-muted-foreground">Theme</span>
          <ThemeSwitcher />
        </div>
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium text-muted-foreground">Map Style</span>
          <ToggleGroup
            type="single"
            value={mapStyle}
            onValueChange={(val) => val && setMapStyle(val as "vector" | "satellite")}
            className="gap-1"
          >
            <ToggleGroupItem value="vector" aria-label="Vector map" size="sm" className="px-2">
              <Map className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="satellite" aria-label="Satellite map" size="sm" className="px-2">
              <Globe className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">System Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent side="left" className="w-72 p-0 border-r-0 [&>button]:hidden">
        <SheetTitle className="px-6 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin Navigation
        </SheetTitle>
        <SheetDescription className="sr-only">Navigate the SmartMap admin workspace.</SheetDescription>
        <SidebarContent pathname={pathname} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
