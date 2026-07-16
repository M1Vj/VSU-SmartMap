import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-bold">404 Not Found</h2>
      <p className="text-muted-foreground">Could not find requested resource</p>
      <Link href="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  )
}
