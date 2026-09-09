import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl">🤷</div>
      <h1 className="mt-4 text-xl font-bold">Sahifa topilmadi</h1>
      <p className="mt-1 text-sm text-gray-500">Bunday xizmat ro‘yxatda yo‘q.</p>
      <Link to="/" className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
        Bosh sahifa
      </Link>
    </div>
  )
}
