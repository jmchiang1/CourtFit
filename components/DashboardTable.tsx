'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RatingBadge } from '@/components/Dashboard/RatingBadge'
import { fmtMoney } from '@/lib/format'
import { ArrowUp, ArrowDown, ArrowUpDown, MoreVertical, Pencil, Trash2, Eye, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'
import { REGIONS, detectRegion, type Region } from '@/lib/region'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PropertyRow } from '@/lib/supabase/types'
import type { Rating } from '@/types/analysis'

type SortKey = 'label' | 'rating' | 'noi' | 'total_courts' | 'payback_years' | 'created_at'
type SortDir = 'asc' | 'desc'

const RATING_ORDER: Record<Rating, number> = {
  'Strong Candidate': 0,
  'Worth Investigating': 1,
  'Risky': 2,
  'Do Not Pursue': 3,
  'Incomplete': 4,
}

interface Props {
  rows: PropertyRow[]
  onView: (row: PropertyRow) => void
  onEdit: (row: PropertyRow) => void
  onDelete: (id: string) => void
}

export function DashboardTable({ rows, onView, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState<'All' | Rating>('All')
  const [regionFilter, setRegionFilter] = useState<'All' | Region>('All')
  // Default: rating ascending = Strong Candidate first → Do Not Pursue last.
  // RATING_ORDER assigns lower numbers to stronger ratings.
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // Recompute analysis fresh from listing_json + assumptions_json so the table
  // always reflects the current calculator logic, not the stale snapshot
  // columns stored in the DB at save time. Keeps the table consistent with
  // the verdict modal (which also recomputes).
  const enrichedRows = useMemo(() => {
    return rows.map((r) => {
      const result = calculateAnalysis({
        listing: r.listing_json,
        // Merge with defaults so older saved properties (missing new fields)
        // compute correctly.
        assumptions: { ...DEFAULT_ASSUMPTIONS, ...r.assumptions_json },
      })
      return {
        row: r,
        rating: result.rating as Rating,
        noi: result.noi,
        totalCourts: result.courts.total,
        paybackYears: result.paybackYears,
        region: detectRegion(r.address),
      }
    })
  }, [rows])

  // Only show region tabs that actually have ≥1 property.
  const visibleRegions = useMemo(() => {
    const present = new Set(enrichedRows.map((e) => e.region).filter(Boolean))
    return REGIONS.filter((r) => present.has(r))
  }, [enrichedRows])

  // If the user has the active tab on a region but no rows match anymore
  // (e.g., they deleted the last property in that borough), drop back to All.
  if (regionFilter !== 'All' && !visibleRegions.includes(regionFilter)) {
    setRegionFilter('All')
  }

  const filteredSorted = useMemo(() => {
    const needle = search.trim().toLowerCase()
    let out = enrichedRows
    if (regionFilter !== 'All') {
      out = out.filter((e) => e.region === regionFilter)
    }
    if (needle) {
      out = out.filter(({ row }) => {
        const hay = `${row.label ?? ''} ${row.address ?? ''}`.toLowerCase()
        return hay.includes(needle)
      })
    }
    if (ratingFilter !== 'All') {
      out = out.filter((e) => e.rating === ratingFilter)
    }
    const sign = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'label': {
          const av = (a.row.label || a.row.address || '').toLowerCase()
          const bv = (b.row.label || b.row.address || '').toLowerCase()
          return av.localeCompare(bv) * sign
        }
        case 'rating':
          return (RATING_ORDER[a.rating] - RATING_ORDER[b.rating]) * sign
        case 'noi':
          return (a.noi - b.noi) * sign
        case 'total_courts':
          return (a.totalCourts - b.totalCourts) * sign
        case 'payback_years': {
          const av = a.paybackYears ?? Infinity
          const bv = b.paybackYears ?? Infinity
          return (av - bv) * sign
        }
        case 'created_at':
        default:
          return (new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime()) * sign
      }
    })
    return out
  }, [enrichedRows, search, ratingFilter, regionFilter, sortKey, sortDir])

  // Jump back to the first page whenever the result set changes shape so we're
  // never stranded on a page that no longer exists.
  useEffect(() => {
    setPage(1)
  }, [search, ratingFilter, regionFilter, pageSize])

  const total = filteredSorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const paged = filteredSorted.slice(pageStart, pageStart + pageSize)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Text-y / "good is low" columns ascend by default; numeric / recency desc.
      setSortDir(key === 'label' || key === 'rating' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="dashboard-table space-y-3">
      {/* Borough / county tabs — only render the ones with ≥1 property */}
      {visibleRegions.length > 0 && (
        <Tabs
          value={regionFilter}
          onValueChange={(v) => setRegionFilter(v as 'All' | Region)}
        >
          <TabsList variant="line" className="flex-wrap h-auto">
            <TabsTrigger value="All">All</TabsTrigger>
            {visibleRegions.map((r) => (
              <TabsTrigger key={r} value={r}>
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search address or label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={ratingFilter}
          onValueChange={(v) => setRatingFilter(v as 'All' | Rating)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Rating: All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">Rating: All</SelectItem>
            <SelectItem value="Strong Candidate">Strong Candidate</SelectItem>
            <SelectItem value="Worth Investigating">Worth Investigating</SelectItem>
            <SelectItem value="Risky">Risky</SelectItem>
            <SelectItem value="Do Not Pursue">Do Not Pursue</SelectItem>
            <SelectItem value="Incomplete">Incomplete</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filteredSorted.length} {filteredSorted.length === 1 ? 'property' : 'properties'}
        </span>
      </div>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Address / Label" active={sortKey === 'label'} dir={sortDir} onClick={() => toggleSort('label')} />
              <SortHeader label="Rating" active={sortKey === 'rating'} dir={sortDir} onClick={() => toggleSort('rating')} />
              <SortHeader label="NOI" active={sortKey === 'noi'} dir={sortDir} onClick={() => toggleSort('noi')} align="right" />
              <SortHeader label="Courts" active={sortKey === 'total_courts'} dir={sortDir} onClick={() => toggleSort('total_courts')} align="right" />
              <SortHeader label="Payback" active={sortKey === 'payback_years'} dir={sortDir} onClick={() => toggleSort('payback_years')} align="right" />
              <SortHeader label="Added" active={sortKey === 'created_at'} dir={sortDir} onClick={() => toggleSort('created_at')} align="right" />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  {rows.length === 0
                    ? 'No saved properties yet. Click "Add new property" to get started.'
                    : 'No properties match the current filters.'}
                </TableCell>
              </TableRow>
            )}
            {paged.map(({ row, rating, noi, totalCourts, paybackYears }) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-white/[0.03]"
                onClick={() => onView(row)}
              >
                <TableCell className="font-medium max-w-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{row.label || row.address || 'Untitled'}</span>
                    {row.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in Google Maps"
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MapPin className="size-3.5" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <RatingBadge rating={rating} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(noi)}</TableCell>
                <TableCell className="text-right tabular-nums">{totalCourts}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {paybackYears !== null ? `${paybackYears.toFixed(1)} yr` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                  {formatDate(row.created_at)}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation() /* prevent row click when using menu */}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="sm" className="size-8 p-0">
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(row)}>
                        <Eye className="size-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm(`Delete "${row.label || row.address || 'this property'}"?`)) {
                            onDelete(row.id)
                          }
                        }}
                        className="text-rose-300"
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {pageStart + 1}–{Math.min(pageStart + pageSize, total)} of {total}
            </span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}
