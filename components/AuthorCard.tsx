import AuthorCarousel from './AuthorCarousel'

interface AuthorProps {
  name: string
  bio: string
  avatar: string
  works: string[]
}

export default function AuthorCard({ name, bio, avatar, works }: AuthorProps) {
  return (
    <div className="group bg-white border border-gray-100 p-6 transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="flex items-center gap-4 mb-6">
        <img 
          src={avatar} 
          alt={name} 
          className="w-16 h-16 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all"
        />
        <div>
          <h3 className="text-xl font-bold tracking-tight">{name}</h3>
          <p className="text-sm text-gray-500 line-clamp-1">{bio}</p>
        </div>
      </div>
      
      {/* Интерактивный элемент карусели */}
      <AuthorCarousel images={works} />
      
      <button className="w-full mt-4 py-2 text-xs font-bold uppercase tracking-widest border border-black hover:bg-black hover:text-white transition">
        Смотреть профиль
      </button>
    </div>
  )
}