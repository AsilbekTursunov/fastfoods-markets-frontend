import type { OrderStatus, PaymentType, DeliveryType } from '@/types'
import { Badge } from './ui'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Yangi',
  accepted: 'Qabul qilindi',
  preparing: 'Tayyorlanmoqda',
  delivering: 'Yo‘lda',
  done: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
}

export const STATUS_COLOR: Record<OrderStatus, 'gray' | 'green' | 'red' | 'blue' | 'amber' | 'purple'> = {
  new: 'blue',
  accepted: 'amber',
  preparing: 'purple',
  delivering: 'amber',
  done: 'green',
  cancelled: 'red',
}

export const STATUS_FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'delivering', 'done']

export const PAYMENT_LABEL: Record<PaymentType, string> = {
  cash: 'Naqd',
  card: 'Karta (terminal)',
  click: 'Click',
  payme: 'Payme',
}

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  delivery: 'Yetkazib berish',
  pickup: 'Olib ketish',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
}
