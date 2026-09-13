import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Upload, X, ImageIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Button, Input, Spinner, Textarea } from '@/components/ui'
import type { Category, Product, ProductVariant } from '@/types'

/**
 * Full-page product editor. It used to live in a bottom sheet, which inside the Telegram
 * mini app could not scroll and hid its own Save button on small phones.
 * Routes: products/new and products/:id/edit
 */

const empty = (categoryId: string): Product => ({ id: '', categoryId, name: '', description: '', price: 0, image: '', available: true, popular: false })

/** One editable size row. Price is a string so the input can be cleared while typing. */
interface VariantDraft {
  id: string // '' for a row that does not exist on the server yet
  name: string
  price: string
  description: string
}

const toDrafts = (v?: ProductVariant[]): VariantDraft[] =>
  (v ?? []).map((x) => ({ id: x.id, name: x.name, price: String(x.price), description: x.description ?? '' }))

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[‘’'ʻ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

/** Keep existing ids stable (carts and past orders point at them); only new rows get one. */
function draftsToVariants(drafts: VariantDraft[]): ProductVariant[] {
  const used = new Set<string>()
  return drafts.map((d, i) => {
    let id = d.id || slugify(d.name) || `v${i + 1}`
    while (used.has(id)) id = `${id}_${i + 1}`
    used.add(id)
    return { id, name: d.name.trim(), price: Number(d.price) || 0, description: d.description.trim() || undefined }
  })
}

export default function ProductEditorPage() {
  const { service = '', id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    Promise.all([api.categories(service), isNew ? Promise.resolve<Product[]>([]) : api.dashboardProducts(service)])
      .then(([cats, products]) => {
        if (!alive) return
        const sorted = [...cats].sort((a, b) => a.sort - b.sort)
        setCategories(sorted)
        if (isNew) {
          setEditing(empty(sorted[0]?.id ?? ''))
          setVariants([])
        } else {
          const p = products.find((x) => x.id === id)
          if (!p) return setLoadError('Mahsulot topilmadi')
          setEditing(p)
          setVariants(toDrafts(p.variants))
        }
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'Yuklashda xatolik'))
    return () => {
      alive = false
    }
  }, [service, id, isNew])

  const back = () => navigate(`/dashboard/${service}/products`, { replace: true })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.categoryId) return setFormError('Avval kategoriya yarating')
    setSaving(true)
    setFormError(null)
    try {
      const built = draftsToVariants(variants)
      if (built.some((v) => !v.name)) throw new Error('Har bir o‘lchamning nomi bo‘lishi kerak')
      if (built.some((v) => v.price <= 0)) throw new Error('Har bir o‘lchamning narxi 0 dan katta bo‘lsin')
      if (!built.length && (!editing.price || editing.price <= 0)) throw new Error('Narxni kiriting')
      await api.upsertProduct(service, {
        ...editing,
        // menu shows the cheapest size as "… dan"
        price: built.length ? Math.min(...built.map((v) => v.price)) : editing.price,
        variants: built.length ? built : undefined,
      })
      back()
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

  if (loadError) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft size={16} /> Mahsulotlar
        </Button>
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
      </div>
    )
  }
  if (!editing) return <Spinner />

  return (
    <div className="mx-auto max-w-2xl pb-6">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={back} className="rounded-xl bg-white p-2 shadow-sm" aria-label="Orqaga">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-extrabold">{isNew ? 'Yangi mahsulot' : 'Tahrirlash'}</h1>
      </div>

      <form onSubmit={save} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
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

        {variants.length === 0 ? (
          <div className="space-y-2">
            <Input
              label="Narx (so‘m)"
              type="number"
              min={0}
              inputMode="numeric"
              value={editing.price || ''}
              onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              required
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setVariants([{ id: '', name: '', price: String(editing.price || ''), description: '' }])}>
              <Plus size={14} /> O‘lchamlarga bo‘lish
            </Button>
            <p className="text-xs text-gray-500">Masalan hot-dog 17 / 24 / 28 sm bo‘lsa, har biriga alohida narx qo‘yiladi.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">O‘lchamlar va narxlar</span>
            {variants.map((v, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <div className="flex gap-2">
                  <input
                    value={v.name}
                    onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Nomi, masalan: Katta (28 sm)"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    value={v.price}
                    onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^0-9]/g, '') } : x)))}
                    placeholder="Narx"
                    inputMode="numeric"
                    className="w-24 shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-brand"
                  />
                  <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-red-500 hover:bg-red-50" aria-label="O‘lchamni o‘chirish">
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  value={v.description}
                  onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  placeholder="Tarkibi (ixtiyoriy)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setVariants([...variants, { id: '', name: '', price: '', description: '' }])}>
                <Plus size={14} /> O‘lcham qo‘shish
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setVariants([])}>
                Bitta narxga qaytarish
              </Button>
            </div>
            <p className="text-xs text-gray-500">Menyuda eng arzon narx «dan» bilan ko‘rsatiladi.</p>
          </div>
        )}

        <Input
          label="Eski narx — chegirma ko‘rsatish uchun (ixtiyoriy)"
          type="number"
          min={0}
          inputMode="numeric"
          value={editing.oldPrice || ''}
          onChange={(e) => setEditing({ ...editing, oldPrice: e.target.value ? Number(e.target.value) : undefined })}
          hint="Joriy narxdan katta bo‘lsa, kartada chizilgan holda va «−N%» belgisi bilan chiqadi"
        />

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Rasm</span>
          <div className="flex items-center gap-3">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-4xl">
              {editing.image && /^(https?:|data:)/.test(editing.image) ? (
                <img src={editing.image} alt="" className="h-full w-full object-cover" />
              ) : editing.image ? (
                editing.image
              ) : (
                <ImageIcon size={26} className="text-gray-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
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
                value={editing.image && /^(https?:|data:)/.test(editing.image) ? '' : (editing.image ?? '')}
                onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                placeholder="yoki emoji: 🍔"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>
          <span className="mt-1 block text-xs text-gray-400">jpeg, png, webp, gif · 15 MB gacha — server o‘zi kichraytiradi</span>
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
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={back}>
            Bekor
          </Button>
          <Button type="submit" full loading={saving}>
            Saqlash
          </Button>
        </div>
      </form>
    </div>
  )
}
