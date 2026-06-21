import InfoPage from '@/components/info/InfoPage'

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms"
      description="Условия использования учебного проекта Creative Archive."
      sections={[
        {
          title: 'Назначение',
          text: 'Сайт создан для демонстрации дипломного проекта и сценариев виртуальной галереи.',
        },
        {
          title: 'Контент',
          text: 'Работы, изображения и описания используются в рамках демонстрации функциональности платформы.',
        },
      ]}
    />
  )
}
