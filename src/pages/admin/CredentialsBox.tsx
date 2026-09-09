import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/** Shown once after an account is created — the password is never returned again. */
export default function CredentialsBox({ login, password, where }: { login: string; password: string; where?: string }) {
  const [copied, setCopied] = useState(false)
  const text = `Login: ${login}\nParol: ${password}${where ? `\nKirish: ${where}` : ''}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the text is on screen anyway */
    }
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
      <div className="mb-1 text-xs font-bold uppercase text-green-700">Hisob yaratildi — parolni hozir saqlab oling</div>
      <div className="font-mono text-sm text-green-900">
        <div>Login: {login}</div>
        <div>Parol: {password}</div>
        {where && <div className="text-green-700">Kirish: {where}</div>}
      </div>
      <button onClick={copy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Nusxa olindi' : 'Nusxa olish'}
      </button>
      <p className="mt-2 text-xs text-green-700">Parol boshqa hech qachon ko‘rsatilmaydi. Yo‘qotsangiz, yangisini o‘rnatasiz.</p>
    </div>
  )
}
