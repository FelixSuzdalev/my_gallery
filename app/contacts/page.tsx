import InfoPage from '@/components/info/InfoPage'

export default function ContactsPage() {
  return (
    <InfoPage
      title="Контакты"
      description="Страница для связи с автором проекта и демонстрации контактного раздела."
      sections={[
        {
          title: 'Автор проекта',
          text: 'Феликс Суздалев, студент МГГТК АГУ группы ИС-43.',
        },
        {
          title: 'Назначение',
          text: 'Проект разработан как дипломная виртуальная галерея для художников, фотографов и дизайнеров.',
        },
      ]}
    />
  )
}
