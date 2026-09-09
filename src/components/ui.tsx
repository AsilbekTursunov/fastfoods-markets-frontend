import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, forwardRef } from 'react'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="spinner" />
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-2xl bg-red-50 p-4 text-center text-red-700">
      <div className="font-medium">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          Qayta urinish
        </button>
      )}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  full?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, full, className, children, disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'
  const v = {
    primary: 'bg-brand text-white shadow-sm',
    secondary: 'bg-brand-soft text-brand',
    ghost: 'bg-gray-100 text-gray-800',
    danger: 'bg-red-600 text-white',
  }[variant]
  const s = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-[15px]', lg: 'px-5 py-3.5 text-base' }[size]
  return (
    <button className={cn(base, v, s, full && 'w-full', className)} disabled={disabled || loading} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }>(
  function Input({ label, error, hint, className, ...rest }, ref) {
    return (
      <label className="block">
        {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20',
            error ? 'border-red-400' : 'border-gray-200',
            className,
          )}
          {...rest}
        />
        {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
      </label>
    )
  },
)

export function Textarea({ label, error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}
      <textarea
        className={cn(
          'w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20',
          error ? 'border-red-400' : 'border-gray-200',
          className,
        )}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-white p-4 shadow-sm', className)}>{children}</div>
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex rounded-xl bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition',
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function QtyControl({ qty, onChange, size = 'md' }: { qty: number; onChange: (q: number) => void; size?: 'sm' | 'md' }) {
  const btn = size === 'sm' ? 'h-7 w-7 text-base' : 'h-9 w-9 text-lg'
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-brand-soft p-0.5">
      <button type="button" onClick={() => onChange(qty - 1)} className={cn('rounded-lg font-bold text-brand', btn)}>
        −
      </button>
      <span className={cn('min-w-6 text-center font-bold text-brand', size === 'sm' ? 'text-sm' : 'text-base')}>{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} className={cn('rounded-lg font-bold text-brand', btn)}>
        +
      </button>
    </div>
  )
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'brand' }) {
  const c = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    brand: 'bg-brand-soft text-brand',
  }[color]
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', c)}>{children}</span>
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="animate-slide-up w-full max-w-lg rounded-t-3xl bg-white pb-safe" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300" />
        {title && <div className="px-5 pt-4 text-lg font-bold">{title}</div>}
        <div className="px-5 pt-3">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="text-6xl">{icon}</div>
      <div className="mt-4 text-lg font-bold">{title}</div>
      {text && <div className="mt-1 text-sm text-gray-500">{text}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
