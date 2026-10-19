'use client'

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import type { LucideIcon } from 'lucide-react'

export type NavItem<V extends string> = { value: V; label: string; icon: LucideIcon }
export type NavAction = { label: string; icon: LucideIcon; onClick: () => void }

/**
 * The app's main navigation: a floating pill pinned near the bottom of the
 * viewport. The active tab sits on an ink capsule that slides between options
 * (positioned from Base UI's --active-tab-* variables). The view's primary
 * action rides alongside in court green, the one green thing in the bar.
 *
 * Sits below dialogs and sheets (z-40 vs z-50), so open overlays cover it.
 */
export function FloatingNav<V extends string>({
  items,
  value,
  onChange,
  action,
}: {
  items: NavItem<V>[]
  value: V
  onChange: (value: V) => void
  action?: NavAction
}) {
  const ActionIcon = action?.icon
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as V)}
      className="floating-nav pointer-events-none fixed inset-x-0 z-40 flex items-center justify-center gap-2 px-4"
      style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
    >
      <TabsPrimitive.List
        aria-label="Main navigation"
        className="pointer-events-auto relative flex items-center gap-1 rounded-full bg-panel/80 p-1.5 shadow-lift backdrop-blur-xl backdrop-saturate-150 dark:bg-panel-2/80"
      >
        <TabsPrimitive.Indicator
          aria-hidden
          className="absolute top-1/2 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-1/2 rounded-full bg-foreground shadow-xs transition-[translate,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        />
        {items.map(({ value: v, label, icon: Icon }) => (
          <TabsPrimitive.Tab
            key={v}
            value={v}
            className="relative z-10 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:text-background data-[active]:hover:text-background"
          >
            <Icon className="size-4" />
            {label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>

      {action && ActionIcon && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className="floating-nav-action pointer-events-auto inline-flex h-[52px] min-w-[52px] items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-lift transition-[background-color,transform] outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] motion-reduce:transition-none sm:px-5"
        >
          <ActionIcon className="size-5" />
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      )}
    </TabsPrimitive.Root>
  )
}
