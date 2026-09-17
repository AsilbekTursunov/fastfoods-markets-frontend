import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Image as ImageIcon,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Button, Input, Sheet, Spinner, Textarea, cn } from "@/components/ui";
import type { PromoSchedule, PromoScheduleInput } from "@/types";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MIN_HOURS = 0.5;

/** "Message interval": announcements the backend re-posts to the group every N hours. */
export default function PromoSchedules({ slug }: { slug: string }) {
  const [list, setList] = useState<PromoSchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromoSchedule | "new" | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const load = useCallback(
    () =>
      api
        .listPromos(slug)
        .then(setList)
        .catch((e) => setError(e instanceof Error ? e.message : "Xatolik")),
    [slug],
  );
  useEffect(() => {
    load();
  }, [load]);

  const replace = (p: PromoSchedule) =>
    setList((l) => (l ?? []).map((x) => (x.id === p.id ? p : x)));

  const toggle = async (p: PromoSchedule) => {
    setBusyId(p.id);
    try {
      replace(
        await api.updatePromo(slug, p.id, {
          text: p.text,
          buttonText: p.buttonText,
          buttonUrl: p.buttonUrl,
          intervalHours: p.intervalHours,
          enabled: !p.enabled,
        }),
      );
    } catch (e) {
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message : "Xatolik",
      });
    } finally {
      setBusyId(null);
    }
  };

  const sendNow = async (p: PromoSchedule) => {
    setBusyId(p.id);
    setNotice(null);
    try {
      replace(await api.sendPromoNow(slug, p.id));
      setNotice({ ok: true, text: `#${p.id} guruhga yuborildi` });
    } catch (e) {
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message : "Yuborilmadi",
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: PromoSchedule) => {
    if (!confirm("E‘lon o‘chirilsinmi? Rasmi ham serverdan o‘chadi.")) return;
    setBusyId(p.id);
    try {
      await api.deletePromo(slug, p.id);
      setList((l) => (l ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message : "Xatolik",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-brand" />
        <h2 className="text-sm font-bold text-gray-500">
          E‘lonlar jadvali (Message interval)
        </h2>
      </div>
      <p className="text-xs text-gray-500">
        Har bir e‘lon — bitta rasm, matn va tugma. Belgilangan interval (soat)
        o‘tganda server uni guruhga o‘zi yuboradi va shu tarzda takrorlab
        turadi. Birinchi yuborish e‘lon yaratilgandan bir interval keyin; «Hozir
        yuborish» darhol yuboradi va hisobni qaytadan boshlaydi.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {!list && !error && <Spinner />}

      {list && list.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
          Hali e‘lon yo‘q
        </div>
      )}

      <ul className="space-y-2">
        {list?.map((p) => (
          <li
            key={p.id}
            className={cn(
              "rounded-xl border p-3",
              p.enabled
                ? "border-gray-200"
                : "border-gray-100 bg-gray-50 opacity-80",
            )}
          >
            <div className="flex gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon size={20} className="text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="line-clamp-2 whitespace-pre-wrap text-sm font-medium text-gray-800">
                    {p.text}
                  </div>
                  {/* enabled switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.enabled}
                    aria-label={p.enabled ? "Faol" : "To‘xtatilgan"}
                    disabled={busyId === p.id}
                    onClick={() => toggle(p)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      p.enabled ? "bg-green-500" : "bg-gray-300",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                        p.enabled ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  har <b>{fmtHours(p.intervalHours)}</b>
                  {p.buttonText && (
                    <>
                      {" "}
                      · tugma: <b>{p.buttonText}</b>
                    </>
                  )}{" "}
                  · yuborildi: {p.sentCount} marta
                </div>
                <div className="text-xs text-gray-500">
                  {p.enabled ? (
                    <>
                      keyingi: <b>{formatDateTime(p.nextRunAt)}</b>
                    </>
                  ) : (
                    "to‘xtatilgan"
                  )}
                  {p.lastSentAt && (
                    <> · oxirgi: {formatDateTime(p.lastSentAt)}</>
                  )}
                </div>
                {p.lastError && (
                  <div className="mt-1 text-xs text-red-600">
                    Oxirgi xato: {p.lastError}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={busyId === p.id}
                onClick={() => sendNow(p)}
              >
                <Send size={14} /> Hozir yuborish
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(p)}
              >
                <Pencil size={14} /> Tahrirlash
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => remove(p)}
              >
                <Trash2 size={14} /> O‘chirish
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setEditing("new")}
        >
          <Plus size={14} /> Yangi e‘lon
        </Button>
        {notice && (
          <span
            className={cn(
              "text-sm",
              notice.ok ? "text-green-600" : "text-red-600",
            )}
          >
            {notice.text}
          </span>
        )}
      </div>

      {editing && (
        <PromoEditor
          slug={slug}
          promo={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setList((l) =>
              l?.some((x) => x.id === p.id)
                ? l.map((x) => (x.id === p.id ? p : x))
                : [...(l ?? []), p],
            );
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} daqiqada`;
  if (h % 24 === 0)
    return h === 24 ? "24 soatda (kuniga 1)" : `${h / 24} kunda`;
  return `${h} soatda`;
}

/** Create / edit sheet. The image is uploaded to the saved row, so a new announcement is created first, then its image goes up. */
function PromoEditor({
  slug,
  promo,
  onClose,
  onSaved,
}: {
  slug: string;
  promo: PromoSchedule | null;
  onClose: () => void;
  onSaved: (p: PromoSchedule) => void;
}) {
  const [form, setForm] = useState<PromoScheduleInput>({
    text: promo?.text ?? "",
    buttonText: promo?.buttonText ?? "Zakaz berish",
    buttonUrl: promo?.buttonUrl ?? "",
    intervalHours: promo?.intervalHours ?? 3,
    enabled: promo?.enabled ?? true,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    promo?.imageUrl ?? null,
  );
  const [pending, setPending] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    },
    [pendingPreview],
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    if (promo) {
      // existing row: upload straight away (the old file is deleted server-side)
      setImgBusy(true);
      try {
        const p = await api.uploadPromoScheduleImage(slug, promo.id, file);
        setImageUrl(p.imageUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Rasm yuklanmadi");
      } finally {
        setImgBusy(false);
      }
    } else {
      setPending(file);
      setPendingPreview(URL.createObjectURL(file));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = async () => {
    if (pending) {
      setPending(null);
      setPendingPreview(null);
      return;
    }
    if (!promo || !imageUrl) return;
    if (!confirm("Rasm o‘chirilsinmi? U serverdan ham o‘chadi.")) return;
    setImgBusy(true);
    try {
      const p = await api.deletePromoScheduleImage(slug, promo.id);
      setImageUrl(p.imageUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rasm o‘chmadi");
    } finally {
      setImgBusy(false);
    }
  };

  const save = async () => {
    setErr(null);
    if (!form.text.trim()) return setErr("E‘lon matnini kiriting");
    if (form.text.length > 1024) return setErr("Matn 1024 belgidan oshmasin");
    if (!(form.intervalHours >= MIN_HOURS))
      return setErr(`Interval kamida ${MIN_HOURS} soat bo‘lsin`);
    setSaving(true);
    try {
      const input: PromoScheduleInput = {
        ...form,
        text: form.text.trim(),
        buttonText: form.buttonText?.trim() ?? "",
        buttonUrl: form.buttonUrl?.trim() ?? "",
      };
      let saved = promo
        ? await api.updatePromo(slug, promo.id, input)
        : await api.createPromo(slug, input);
      if (pending)
        saved = await api.uploadPromoScheduleImage(slug, saved.id, pending);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const preview = pendingPreview ?? imageUrl;

  return (
    <Sheet
      open
      onClose={onClose}
      title={promo ? `E‘lon #${promo.id}` : "Yangi e‘lon"}
    >
      <div className="space-y-3 pb-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Rasm (bitta)
          </span>
          <div className="flex items-start gap-3">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon size={26} className="text-gray-400" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={imgBusy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} /> {preview ? "Almashtirish" : "Rasm yuklash"}
              </Button>
              {preview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={imgBusy}
                  onClick={removeImage}
                >
                  <X size={14} /> O‘chirish
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        <Textarea
          label="Matn"
          rows={4}
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          maxLength={1024}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Tugma nomi"
            value={form.buttonText ?? ""}
            onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
            maxLength={40}
            hint="bo‘sh qoldirsangiz tugma bo‘lmaydi"
          />
          <Input
            label="Tugma havolasi"
            value={form.buttonUrl ?? ""}
            onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
            placeholder="https://…"
            hint="bo‘sh = mini app ochiladi"
          />
        </div>
        <Input
          label="Interval (soat)"
          type="number"
          inputMode="decimal"
          min={MIN_HOURS}
          step={0.5}
          value={form.intervalHours}
          onChange={(e) =>
            setForm({ ...form, intervalHours: Number(e.target.value) })
          }
          hint="masalan 3 = har 3 soatda, 24 = kuniga bir marta, 0.5 = har 30 daqiqada"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled ?? true}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />{" "}
          Faol (avtomatik yuborilsin)
        </label>

        {err && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" loading={saving} onClick={save} full>
            Saqlash
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
