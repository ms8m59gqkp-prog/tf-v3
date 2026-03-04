import { describe, it, expect } from 'vitest'
import {
  CONSIGNMENT_STATUSES,
  CONSIGNMENT_TRANSITIONS,
} from '@/lib/types/domain/consignment'
import {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
} from '@/lib/types/domain/order'
import {
  COMMISSION_RATES,
} from '@/lib/types/domain/seller'
import {
  MEASUREMENT_FIELDS,
} from '@/lib/types/domain/product'
import {
  SETTLEMENT_STATUSES,
  SOLD_ITEM_STATUSES,
} from '@/lib/types/domain/settlement'
import {
  BATCH_STATUSES,
} from '@/lib/types/domain/photo'

describe('ConsignmentStatus', () => {
  it('has exactly 7 values', () => {
    expect(CONSIGNMENT_STATUSES).toHaveLength(7)
  })

  it('includes all required statuses', () => {
    const required = ['pending', 'received', 'inspecting', 'approved', 'on_hold', 'rejected', 'completed']
    for (const status of required) {
      expect(CONSIGNMENT_STATUSES).toContain(status)
    }
  })

  it('CONSIGNMENT_TRANSITIONS covers all statuses', () => {
    const transitionKeys = Object.keys(CONSIGNMENT_TRANSITIONS)
    expect(transitionKeys).toHaveLength(7)
    for (const status of CONSIGNMENT_STATUSES) {
      expect(transitionKeys).toContain(status)
    }
  })

  it('transition targets are valid statuses', () => {
    for (const targets of Object.values(CONSIGNMENT_TRANSITIONS)) {
      for (const target of targets) {
        expect(CONSIGNMENT_STATUSES).toContain(target)
      }
    }
  })

  it('terminal states have no transitions', () => {
    expect(CONSIGNMENT_TRANSITIONS.rejected).toHaveLength(0)
    expect(CONSIGNMENT_TRANSITIONS.completed).toHaveLength(0)
  })
})

describe('OrderStatus', () => {
  it('has exactly 10 values (V2 8 + CONFIRMED + CANCELLED)', () => {
    expect(ORDER_STATUSES).toHaveLength(10)
  })

  it('includes all required statuses', () => {
    const required = ['APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED', 'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE', 'CONFIRMED', 'CANCELLED']
    for (const status of required) {
      expect(ORDER_STATUSES).toContain(status)
    }
  })

  it('ALLOWED_TRANSITIONS covers all statuses', () => {
    const transitionKeys = Object.keys(ALLOWED_TRANSITIONS)
    expect(transitionKeys).toHaveLength(10)
    for (const status of ORDER_STATUSES) {
      expect(transitionKeys).toContain(status)
    }
  })

  it('transition targets are valid statuses', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ORDER_STATUSES).toContain(target)
      }
    }
  })

  it('terminal states have no transitions', () => {
    expect(ALLOWED_TRANSITIONS.CONFIRMED).toHaveLength(0)
    expect(ALLOWED_TRANSITIONS.CANCELLED).toHaveLength(0)
  })

  it('V2 workflow: APPLIED → SHIPPING → COLLECTED → INSPECTED', () => {
    expect(ALLOWED_TRANSITIONS.APPLIED).toContain('SHIPPING')
    expect(ALLOWED_TRANSITIONS.SHIPPING).toContain('COLLECTED')
    expect(ALLOWED_TRANSITIONS.COLLECTED).toContain('INSPECTED')
  })

  it('V2 workflow: INSPECTED branches to PRICE_ADJUSTING or IMAGE_PREPARING', () => {
    expect(ALLOWED_TRANSITIONS.INSPECTED).toContain('PRICE_ADJUSTING')
    expect(ALLOWED_TRANSITIONS.INSPECTED).toContain('IMAGE_PREPARING')
  })

  it('all non-terminal states can transition to CANCELLED', () => {
    for (const status of ORDER_STATUSES) {
      if (status === 'CONFIRMED' || status === 'CANCELLED') continue
      expect(ALLOWED_TRANSITIONS[status]).toContain('CANCELLED')
    }
  })
})

describe('COMMISSION_RATES', () => {
  it('has all 3 tiers', () => {
    expect(Object.keys(COMMISSION_RATES)).toHaveLength(3)
    expect(COMMISSION_RATES.general).toBeDefined()
    expect(COMMISSION_RATES.employee).toBeDefined()
    expect(COMMISSION_RATES.vip).toBeDefined()
  })

  it('rates are valid percentages (0 < rate < 1)', () => {
    for (const rate of Object.values(COMMISSION_RATES)) {
      expect(rate).toBeGreaterThan(0)
      expect(rate).toBeLessThan(1)
    }
  })
})

describe('MEASUREMENT_FIELDS', () => {
  it('has 8 measurement fields', () => {
    expect(MEASUREMENT_FIELDS).toHaveLength(8)
  })
})

describe('SETTLEMENT_STATUSES', () => {
  it('has 3 values', () => {
    expect(SETTLEMENT_STATUSES).toHaveLength(3)
  })
})

describe('SOLD_ITEM_STATUSES', () => {
  it('has 2 values', () => {
    expect(SOLD_ITEM_STATUSES).toHaveLength(2)
  })
})

describe('BATCH_STATUSES', () => {
  it('has 4 values', () => {
    expect(BATCH_STATUSES).toHaveLength(4)
  })
})
