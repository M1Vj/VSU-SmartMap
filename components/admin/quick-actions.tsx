import Link from 'next/link';
import { Plus, ClipboardList, Calendar, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Jump to the most common admin tasks.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/admin/facilities">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add facility
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/admin/boarding-houses">
            <Home className="mr-2 h-4 w-4" aria-hidden />
            Review boarding houses
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/admin/events">
            <Calendar className="mr-2 h-4 w-4" aria-hidden />
            Manage events
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/admin/suggestions">
            <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
            Review suggestions
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
