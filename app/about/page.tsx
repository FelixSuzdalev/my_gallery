import InfoPage from '@/components/info/InfoPage'

export default function AboutPage() {
  return (
    <InfoPage
      title="О проекте"
      description="Creative Archive — дипломный проект виртуальной галереи на Next.js, React, TypeScript, Tailwind CSS и Supabase."
      sections={[
        {
          title: 'Идея',
          text: 'Сайт помогает показывать визуальные работы без лишней социальной механики и магазинного ощущения.',
        },
        {
          title: 'Автор',
          text: 'Проект разработал Феликс Суздалев, студент МГГТК АГУ группы ИС-43.',
        },
      ]}
    />
  )
}
