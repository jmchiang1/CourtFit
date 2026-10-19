'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal } from 'lucide-react'
import type { Assumptions } from '@/types/analysis'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'

interface Props {
  value: Assumptions
  onChange: (next: Assumptions) => void
}

type NumericKey = Exclude<keyof Assumptions, 'modelVersion'>
type Field = { key: NumericKey; label: string; step?: string }

// Grouped like the cash-flow workbook the defaults come from. Percentages are
// entered as decimals (0.5 = 50%).
const groups: Array<{ label: string; fields: Field[] }> = [
  {
    label: 'The facility',
    fields: [
      { key: 'usableCourtAreaPct', label: 'Floor used for courts', step: '0.01' },
      { key: 'courtSqft', label: 'Sf per court (with buffer)' },
    ],
  },
  {
    label: 'Private court bookings',
    fields: [
      { key: 'peakRate', label: 'Peak rate $/hr' },
      { key: 'offPeakRate', label: 'Non-peak rate $/hr' },
      { key: 'peakHoursPerWeek', label: 'Peak hrs/wk per court', step: '0.5' },
      { key: 'offPeakHoursPerWeek', label: 'Non-peak hrs/wk per court', step: '0.5' },
      { key: 'peakBookingPct', label: 'Peak booked share', step: '0.01' },
      { key: 'offPeakBookingPct', label: 'Non-peak booked share', step: '0.01' },
      { key: 'weeksPerYear', label: 'Weeks per year' },
    ],
  },
  {
    label: 'Open play',
    fields: [
      { key: 'openPlayCourtSessionsPerCourtWeek', label: 'Court-sessions/wk per court', step: '0.1' },
      { key: 'openPlayPlayersPerCourt', label: 'Players per court' },
      { key: 'openPlayFillPct', label: 'Fill rate', step: '0.01' },
      { key: 'dropInPrice', label: 'Drop-in $/session' },
      { key: 'pass10PricePerCheckIn', label: '10x pass $/check-in' },
      { key: 'pass20PricePerCheckIn', label: '20x pass $/check-in' },
      { key: 'dropInSharePct', label: 'Share paid as drop-in', step: '0.01' },
      { key: 'pass10SharePct', label: 'Share on 10x pass', step: '0.01' },
      { key: 'pass20SharePct', label: 'Share on 20x pass', step: '0.01' },
    ],
  },
  {
    label: 'Coaching',
    fields: [
      { key: 'groupSessionsPerCourtWeek', label: 'Group sessions/wk per court', step: '0.1' },
      { key: 'studentsPerGroupSession', label: 'Students per session' },
      { key: 'groupPricePerStudent', label: 'Group $/student' },
      { key: 'privateLessonHoursPerCourtWeek', label: 'Private lesson hrs/wk per court', step: '0.1' },
      { key: 'privateLessonRate', label: 'Private lesson $/hr' },
      { key: 'coachSharePct', label: 'Coach’s share', step: '0.01' },
    ],
  },
  {
    label: 'Pro shop, food & beverage',
    fields: [
      { key: 'proShopPctOfCourtRevenue', label: 'Pro shop, share of court revenue', step: '0.005' },
      { key: 'proShopMarginPct', label: 'Pro shop margin', step: '0.01' },
      { key: 'foodBeveragePctOfCourtRevenue', label: 'F&B, share of court revenue', step: '0.005' },
      { key: 'foodBeverageMarginPct', label: 'F&B margin', step: '0.01' },
      { key: 'cardSurchargePct', label: 'Card surcharge to customer', step: '0.005' },
    ],
  },
  {
    label: 'Staff',
    fields: [
      { key: 'ownerSalaryPerYr', label: 'Owner salary $/yr' },
      { key: 'staffWagesPerYr', label: 'Staff wages $/yr' },
      { key: 'payrollTaxPct', label: 'Payroll tax', step: '0.001' },
      { key: 'workersCompPerYr', label: 'Workers comp $/yr' },
    ],
  },
  {
    label: 'Running the building',
    fields: [
      { key: 'nnnPerSqftYr', label: 'NNN on top of rent $/sf/yr', step: '0.5' },
      { key: 'electricityPerSqftYr', label: 'Electricity $/sf/yr', step: '0.01' },
      { key: 'gasPerSqftYr', label: 'Gas & heating $/sf/yr', step: '0.01' },
      { key: 'waterPerSqftYr', label: 'Water & sewer $/sf/yr', step: '0.01' },
      { key: 'trashPerSqftYr', label: 'Trash $/sf/yr', step: '0.01' },
      { key: 'repairsPerSqftYr', label: 'Repairs $/sf/yr', step: '0.01' },
      { key: 'replacementReservePct', label: 'Replacement reserve, share of sales', step: '0.001' },
      { key: 'liabilityInsurancePerCourtYr', label: 'Liability insurance $/court/yr' },
      { key: 'propertyInsurancePerSqftYr', label: 'Property insurance $/sf/yr', step: '0.01' },
    ],
  },
  {
    label: 'Admin, marketing & fees',
    fields: [
      { key: 'adminPerYr', label: 'Admin & professional $/yr' },
      { key: 'bookingSoftwarePerCourtYr', label: 'Booking software $/court/yr' },
      { key: 'marketingPerYr', label: 'Marketing $/yr (stabilized)' },
      { key: 'cardProcessingPct', label: 'Card processing, share of sales', step: '0.005' },
      { key: 'contingencyPct', label: 'Contingency, share of sales', step: '0.005' },
    ],
  },
  {
    label: 'Year one',
    fields: [
      { key: 'yearOneBookingPct', label: 'Average booking vs stabilized', step: '0.01' },
      { key: 'yearOneMarketingPerYr', label: 'Year-one marketing $/yr' },
    ],
  },
  {
    label: 'What it costs to open',
    fields: [
      { key: 'buildoutPerSqft', label: 'Buildout $/sf' },
      { key: 'permitsArchitecturePerSqft', label: 'Permits & architecture $/sf', step: '0.25' },
      { key: 'equipmentPerCourt', label: 'Equipment $/court' },
      { key: 'furniturePerSqft', label: 'Furniture $/sf', step: '0.25' },
      { key: 'proShopInventoryPerCourt', label: 'Pro shop inventory $/court' },
      { key: 'signage', label: 'Signage $' },
      { key: 'coolersShelving', label: 'Coolers & shelving $' },
      { key: 'foodBeverageInventory', label: 'F&B inventory $' },
      { key: 'legalStartup', label: 'One-time legal $' },
      { key: 'suppliesWebsite', label: 'Supplies & website $' },
      { key: 'securityDepositMonths', label: 'Security deposit, months of rent' },
      { key: 'workingCapitalMonths', label: 'Working capital, months of expenses', step: '0.5' },
    ],
  },
]

export function AssumptionsPanel({ value, onChange }: Props) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="assumptions-trigger gap-2">
            <SlidersHorizontal className="size-4" />
            Assumptions
          </Button>
        }
      />
      <DialogContent className="assumptions-dialog sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Assumptions</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(DEFAULT_ASSUMPTIONS)}
            >
              Reset to defaults
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h4 className="font-display text-sm font-semibold text-foreground mb-2">
                {group.label}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {group.fields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      type="number"
                      className="tabular-nums"
                      step={f.step}
                      value={value[f.key]}
                      onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
