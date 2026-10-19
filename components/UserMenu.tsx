'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, ChevronDown } from 'lucide-react'
import { signOut } from '@/app/actions/auth'

export function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 max-w-[200px]">
            <span className="truncate text-xs">{email}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {/* <div className="px-2 py-1.5">
          <div className="text-xs text-muted-foreground">
            Signed in as
          </div>
          <div className="text-xs font-normal truncate mt-0.5">{email}</div>
        </div> */}
        {/* <DropdownMenuSeparator /> */}
        <form action={signOut}>
          <DropdownMenuItem
            render={
              <button type="submit" className="w-full">
                <LogOut className="size-4" /> Sign out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
