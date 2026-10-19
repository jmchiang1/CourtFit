'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ExtractedListing } from '@/types/analysis'
import { ESTIMATED_RENT_PER_SQFT_YR } from '@/lib/calculator'

interface Props {
  value: ExtractedListing
  onChange: (next: ExtractedListing) => void
  /** Optional slot for header action(s) — e.g. an Assumptions button. */
  headerAction?: React.ReactNode
}

const Field = (props: {
  label: string
  type?: 'text' | 'number'
  value: string | number | null
  onChange: (v: string | number | null) => void
  step?: string
  placeholder?: string
  hint?: string
}) => {
  const isEmpty = props.value == null || props.value === ''
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <Input
        type={props.type ?? 'text'}
        step={props.step}
        placeholder={props.placeholder}
        value={props.value == null ? '' : props.value}
        onChange={(e) => {
          const v = e.target.value
          if (props.type === 'number') props.onChange(v === '' ? null : Number(v))
          else props.onChange(v === '' ? null : v)
        }}
      />
      {isEmpty && props.hint && (
        <p className="text-[11px] text-caution">{props.hint}</p>
      )}
    </div>
  )
}

export function PropertyForm({ value, onChange, headerAction }: Props) {
  const set = <K extends keyof ExtractedListing>(k: K, v: ExtractedListing[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <Card className="property-form-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Property details</CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Address" value={value.address} onChange={v => set('address', v as string | null)} />
        <Field label="Zoning" value={value.zoning} onChange={v => set('zoning', v as string | null)} />
        <Field label="Total sq ft" type="number" value={value.totalSqft} onChange={v => set('totalSqft', v as number | null)} />
        <Field label="Warehouse sq ft" type="number" value={value.warehouseSqft} onChange={v => set('warehouseSqft', v as number | null)} />
        <Field label="Office sq ft" type="number" value={value.officeSqft} onChange={v => set('officeSqft', v as number | null)} />
        <Field label="Clear height (ft)" type="number" value={value.clearHeight} onChange={v => set('clearHeight', v as number | null)} />
        <Field
          label="Base rent ($/sf/yr)"
          type="number"
          step="0.01"
          value={value.rentPerSqftYr}
          onChange={(v) => set('rentPerSqftYr', v as number | null)}
          placeholder={String(ESTIMATED_RENT_PER_SQFT_YR)}
          hint={`Using $${ESTIMATED_RENT_PER_SQFT_YR}/sf/yr as an estimate (NNN is added from assumptions)`}
        />
        <Field label="Loading" value={value.loading} onChange={v => set('loading', v as string | null)} />
        <div className="sm:col-span-2">
          <Field
            label="Source listing URL"
            value={value.sourceUrl}
            onChange={(v) => set('sourceUrl', v as string | null)}
            placeholder="https://www.loopnet.com/..."
          />
        </div>
      </CardContent>
    </Card>
  )
}
