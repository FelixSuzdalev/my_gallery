'use client'


export default function Footer() {
  return (
    <footer className="bg-[#0b0b0f] text-white py-20 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-14">
          <div>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">Stay <br /> Curious.</h2>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors cursor-pointer text-[10px]">IG</div>
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors cursor-pointer text-[10px]">TW</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
            <div className="space-y-3">
              <p className="text-white">Навигация</p>
              <p className="hover:text-white cursor-pointer transition-colors">Галерея</p>
              <p className="hover:text-white cursor-pointer transition-colors">Авторы</p>
              <p className="hover:text-white cursor-pointer transition-colors">Подборки</p>
            </div>
            <div className="space-y-3">
              <p className="text-white">Инфо</p>
              <p className="hover:text-white cursor-pointer transition-colors">FAQ</p>
              <p className="hover:text-white cursor-pointer transition-colors">Контакты</p>
              <p className="hover:text-white cursor-pointer transition-colors">Помощь</p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between gap-4 text-[11px] font-mono text-zinc-500 uppercase">
          <p>© 2024 Digital Art Archive. Platform for creators.</p>
          <p>Built with Supabase & Next.js</p>
        </div>
      </div>
    </footer>
  )
}