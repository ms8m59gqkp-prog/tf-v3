/**
 * 실측 14카테고리 필드 프리셋
 * WHY: 주문 검수 Step2에서 카테고리별 측정 항목 표시
 * HOW: category → fields[] 매핑
 * WHERE: orders/MeasurementStep.tsx
 */

export interface MeasurementField {
  label: string
  key: string
}

export interface MeasurementCategory {
  name: string
  fields: MeasurementField[]
}

export const MEASUREMENT_CATEGORIES: MeasurementCategory[] = [
  {
    name: '자켓/블레이저',
    fields: [
      { label: '어깨', key: 'shoulder' },
      { label: '가슴', key: 'chest' },
      { label: '소매', key: 'sleeve' },
      { label: '총장', key: 'length' },
    ],
  },
  {
    name: '셔츠',
    fields: [
      { label: '어깨', key: 'shoulder' },
      { label: '가슴', key: 'chest' },
      { label: '소매', key: 'sleeve' },
      { label: '총장', key: 'length' },
      { label: '목둘레', key: 'neck' },
    ],
  },
  {
    name: '바지/슬랙스',
    fields: [
      { label: '허리', key: 'waist' },
      { label: '엉덩이', key: 'hip' },
      { label: '허벅지', key: 'thigh' },
      { label: '밑위', key: 'rise' },
      { label: '밑단', key: 'hem' },
      { label: '총장', key: 'length' },
    ],
  },
  {
    name: '코트/아우터',
    fields: [
      { label: '어깨', key: 'shoulder' },
      { label: '가슴', key: 'chest' },
      { label: '소매', key: 'sleeve' },
      { label: '총장', key: 'length' },
    ],
  },
  {
    name: '넥타이',
    fields: [
      { label: '폭', key: 'width' },
      { label: '길이', key: 'length' },
    ],
  },
  {
    name: '스카프',
    fields: [
      { label: '가로', key: 'width' },
      { label: '세로', key: 'height' },
    ],
  },
  {
    name: '머플러',
    fields: [
      { label: '폭', key: 'width' },
      { label: '길이', key: 'length' },
    ],
  },
  {
    name: '장갑',
    fields: [
      { label: '총장', key: 'length' },
      { label: '폭', key: 'width' },
    ],
  },
  {
    name: '벨트',
    fields: [
      { label: '전체 길이', key: 'length' },
      { label: '폭', key: 'width' },
    ],
  },
  {
    name: '가방',
    fields: [
      { label: '가로', key: 'width' },
      { label: '세로', key: 'height' },
      { label: '깊이', key: 'depth' },
    ],
  },
  {
    name: '지갑',
    fields: [
      { label: '가로', key: 'width' },
      { label: '세로', key: 'height' },
    ],
  },
  {
    name: '안경',
    fields: [
      { label: '렌즈 폭', key: 'lensWidth' },
      { label: '브릿지', key: 'bridge' },
      { label: '다리 길이', key: 'templeLength' },
    ],
  },
  {
    name: '서스펜더',
    fields: [
      { label: '전체 길이', key: 'length' },
      { label: '폭', key: 'width' },
    ],
  },
  {
    name: '악세서리',
    fields: [
      { label: '가로', key: 'width' },
      { label: '세로', key: 'height' },
      { label: '깊이', key: 'depth' },
    ],
  },
]
