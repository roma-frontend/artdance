"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          /*
           * Sonner читает CSS-переменные напрямую, а не через Tailwind-утилиты,
           * поэтому здесь имена наших токенов из `tokens.css`, а не роли shadcn
           * (`--popover`, `--border`, `--radius` в этом проекте не существуют —
           * источник истины один: src/design/tokens/semantic.ts).
           */
          '--normal-bg': 'var(--surface-card)',
          '--normal-text': 'var(--content-primary)',
          '--normal-border': 'var(--border-default)',
          '--border-radius': 'var(--radius-lg)',
          '--success-bg': 'var(--success-soft)',
          '--success-text': 'var(--content-primary)',
          '--error-bg': 'var(--danger-soft)',
          '--error-text': 'var(--content-primary)',
          '--warning-bg': 'var(--warning-soft)',
          '--warning-text': 'var(--content-primary)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
