"use client"

import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Toaster as Sonner } from "sonner"
import { useIsMobile } from "@/lib/hooks/use-is-mobile"
import { shouldShowStudentNavigation } from "@/lib/navigation/student-navigation"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const toastOffset = isMobile && shouldShowStudentNavigation(pathname)
    ? { bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }
    : undefined

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      offset={toastOffset}
      mobileOffset={toastOffset}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
