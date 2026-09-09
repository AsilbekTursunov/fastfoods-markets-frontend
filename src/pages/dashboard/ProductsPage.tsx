import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Tags, Upload, X, ImageIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { money } from '@/lib/format'
import { Button, Input, Sheet, Spinner, Textarea, cn } from '@/components/ui'
import type { Category, CategoryTemplate, Product, ProductVariant } from '@/types'

const empty = (categoryId: string): Product => ({ id: '', categoryId, name: '', description: '', price: 0, image: '', available: true, popular: false })

/** "Kichik (17 sm) = 8000 | 1x sosiska" per line  <->  ProductVariant[] */
const variantsToText = (v?: ProductVariant[]) => (v ?? []).map((x) => `${x.name} = ${x.price}${x.description ? ` | ${x.description}` : ''}`).join('\n')
const textToVariants = (t: string): ProductVariant[] =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const [left, description] = l.split('|').map((x) => x.trim())
      const [name, price] = left.split('=').map((x) => x.trim())
      return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `v${i}`, name, price: Number(price) || 0, description: description || undefined }
    })
    .filter((x) => x.name)

const priceLabel = (p: Product) => {
  if (!p.variants?.length) return money(p.price)
  const prices = p.variants.map((x) => x.price)
  const min = Math.min(...prices), max = Math.max(...prices)
  return min === max ? money(min) : `${money(min)} – ${money(max)}`
}

export default function ProductsPage() {
  const { service = '' } = useParams()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [variantText, setVariantText] = useState('')
  const [catsOpen, setCatsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () =>
    Promise.all([api.dashboardProducts(service), api.categories(service)]).then(([p, c]) => {
      setProducts(p)
      setCategories([...c].sort((a, b) => a.sort - b.sort))
    })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service])

  const toggle = async (p: Product, key: 'available' | 'popular') => {
    const next = { ...p, [key]: !p[key] }
    setProducts((l) => l?.map((x) => (x.id === p.id ? next : x)) ?? null)
    await api.upsertProduct(service, next)
  }

  const remove = async (p: Product) => {
    if (!confirm(`"${p.name}" o‘chirilsinmi?`)) return
    await api.deleteProduct(service, p.id)
    setProducts((l) => l?.filter((x) => x.id !== p.id) ?? null)
  }

  const openEditor = (p: Product) => {
    setVariantText(variantsToText(p.variants))
    setFormError(null)
    setEditing(p)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.categoryId) return setFormError('Avval kategoriya yarating')
    setSaving(true)
    setFormError(null)
    try {
      const variants = textToVariants(variantText)
      await api.upsertProduct(service, { ...editing, variants: variants.length ? variants : undefined })
      await load()
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file || !editing) return
    setUploading(true)
    setFormError(null)
    try {
      const url = await api.uploadImage(service, file)
      setEditing((p) => (p ? { ...p, image: url } : p))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Rasm yuklanmadi')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const shown = products?.filter((p) => !filter || p.categoryId === filter) ?? []

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-extrabold">Mahsulotlar</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCatsOpen(true)}>
            <Tags size={16} /> Kategoriyalar
          </Button>
          <Button size="sm" onClick={() => openEditor(empty(categories[0]?.id ?? ''))}>
            <Plus size={16} /> Qo‘shish
          </Button>
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilter('')} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold', !filter ? 'bg-brand text-white' : 'bg-white shadow-sm')}>
          Hammasi
        </button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold', filter === c.id ? 'bg-brand text-white' : 'bg-white shadow-sm')}>
            {c.name}
          </button>
        ))}
      </div>

      {products === null ? (
        <Spinner />
      ) : products.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">
          Hali mahsulot yo‘q.{' '}
          {categories.length === 0 ? (
            <button className="font-semibold text-brand" onClick={() => setCatsOpen(true)}>Avval kategoriya yarating →</button>
          ) : (
            <button className="font-semibold text-brand" onClick={() => openEditor(empty(categories[0].id))}>Birinchi mahsulotni qo‘shing →</button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Mahsulot</th>
                <th className="hidden px-4 py-2 md:table-cell">Kategoriya</th>
                <th className="px-4 py-2">Narx</th>
                <th className="px-4 py-2 text-center">Mavjud</th>
                <th className="hidden px-4 py-2 text-center md:table-cell">Ommabop</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={cn('border-t border-gray-100', !p.available && 'opacity-60')}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {p.image && /^(https?:|data:)/.test(p.image) ? (
                        <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <span className="text-2xl">{p.image || '🍽'}</span>
                      )}
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-gray-400 md:hidden">{catName(p.categoryId)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2 text-gray-600 md:table-cell">{catName(p.categoryId)}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">
                    {priceLabel(p)}
                    {p.variants && <div className="text-xs font-normal text-gray-400">{p.variants.length} o‘lcham</div>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Toggle on={p.available} onChange={() => toggle(p, 'available')} />
                  </td>
                  <td className="hidden px-4 py-2 text-center md:table-cell">
                    <Toggle on={!!p.popular} onChange={() => toggle(p, 'popular')} />
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openEditor(p)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(p)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Tahrirlash' : 'Yangi mahsulot'}>
        {editing && (
          <form onSubmit={save} className="space-y-3 pb-2">
            <Input label="Nomi" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Kategoriya</span>
              <select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3">
                {categories.length === 0 && <option value="">— kategoriya yo‘q —</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {!variantText.trim() && (
              <Input label="Narx (so‘m)" type="number" min={0} value={editing.price || ''} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} required />
            )}
            <Textarea
              label="O‘lchamlar / variantlar (ixtiyoriy)"
              rows={4}
              value={variantText}
              onChange={(e) => setVariantText(e.target.value)}
              placeholder={'Har qatorda:  Nomi = narx | tavsif\nKichik (17 sm) = 8000 | 1x sosiska, sabzi salat\nKatta (28 sm) = 20000'}
              className="font-mono text-sm"
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Rasm</span>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-3xl">
                  {editing.image && /^(https?:|data:)/.test(editing.image) ? (
                    <img src={editing.image} alt="" className="h-full w-full object-cover" />
                  ) : editing.image ? (
                    editing.image
                  ) : (
                    <ImageIcon size={22} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload size={14} /> Rasm yuklash
                    </Button>
                    {editing.image && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ ...editing, image: '' })}>
                        <X size={14} /> O‘chirish
                      </Button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                  <input
                    value={editing.image && /^(https?:|data:)/.test(editing.image) ? '' : editing.image ?? ''}
                    onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                    placeholder="yoki emoji: 🍔"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>
              <span className="mt-1 block text-xs text-gray-400">jpeg, png, webp, gif · 5 MB gacha</span>
            </div>
            <Textarea label="Tavsif" rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} /> Mavjud
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!editing.popular} onChange={(e) => setEditing({ ...editing, popular: e.target.checked })} /> Ommabop
              </label>
            </div>
            {formError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
            <Button type="submit" full loading={saving}>
              Saqlash
            </Button>
          </form>
        )}
      </Sheet>

      <CategoriesSheet
        open={catsOpen}
        onClose={() => setCatsOpen(false)}
        slug={service}
        categories={categories}
        productCount={(id) => products?.filter((p) => p.categoryId === id).length ?? 0}
        onChanged={load}
      />
    </div>
  )
}

function CategoriesSheet({
  open,
  onClose,
  slug,
  categories,
  productCount,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  slug: string
  categories: Category[]
  productCount: (id: string) => number
  onChanged: () => Promise<void>
}) {
  const [templates, setTemplates] = useState<CategoryTemplate[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (open) api.categoryTemplates(slug).then(setTemplates).catch(() => setTemplates([]))
  }, [open, slug])

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(null)
    }
  }

  const addTemplate = (t: CategoryTemplate) => run(`t:${t.id}`, () => api.createCategory(slug, { id: t.id, name: t.name, sort: t.sort }))
  const addManual = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    run('manual', () => api.createCategory(slug, { name: name.trim() })).then(() => setName(''))
  }
  const rename = (c: Category) =>
    run(`e:${c.id}`, () => api.updateCategory(slug, c.id, { name: editName.trim() || c.name, sort: c.sort })).then(() => setEditId(null))
  const remove = (c: Category) => {
    if (!confirm(`"${c.name}" kategoriyasi o‘chirilsinmi?`)) return
    run(`d:${c.id}`, () => api.deleteCategory(slug, c.id))
  }
  const move = (c: Category, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort - b.sort)
    const i = sorted.findIndex((x) => x.id === c.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    const other = sorted[j]
    run(`m:${c.id}`, async () => {
      await api.updateCategory(slug, c.id, { name: c.name, sort: other.sort })
      await api.updateCategory(slug, other.id, { name: other.name, sort: c.sort })
    })
  }

  const existing = new Set(categories.map((c) => c.id))
  const available = templates.filter((t) => !existing.has(t.id))

  return (
    <Sheet open={open} onClose={onClose} title="Kategoriyalar">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pb-3">
        <div className="space-y-1.5">
          {categories.length === 0 && <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Hali kategoriya yo‘q. Quyidagi tayyor ro‘yxatdan tanlang yoki o‘zingiz yozing.</div>}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              {editId === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename(c)
                  }}
                >
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand" />
                  <Button type="submit" size="sm" loading={busy === `e:${c.id}`}>OK</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Bekor</Button>
                </form>
              ) : (
                <>
                  <div className="flex flex-col">
                    <button className="text-gray-400 disabled:opacity-30" disabled={!!busy} onClick={() => move(c, -1)} aria-label="Yuqoriga">▲</button>
                    <button className="text-gray-400 disabled:opacity-30" disabled={!!busy} onClick={() => move(c, 1)} aria-label="Pastga">▼</button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-gray-400">{productCount(c.id)} ta mahsulot · {c.id}</div>
                  </div>
                  <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={15} /></button>
                  <button onClick={() => remove(c)} disabled={busy === `d:${c.id}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>

        {available.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-bold uppercase text-gray-400">Tayyor kategoriyalar</div>
            <div className="flex flex-wrap gap-2">
              {available.map((t) => (
                <button
                  key={t.id}
                  disabled={!!busy}
                  onClick={() => addTemplate(t)}
                  className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {busy === `t:${t.id}` ? '…' : `+ ${t.emoji ? `${t.emoji} ` : ''}${t.name}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={addManual} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yangi kategoriya nomi" className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
          <Button type="submit" size="sm" loading={busy === 'manual'} disabled={!name.trim()}>
            <Plus size={14} /> Qo‘shish
          </Button>
        </form>

        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </Sheet>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className={cn('relative h-6 w-11 rounded-full transition', on ? 'bg-green-500' : 'bg-gray-300')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}
