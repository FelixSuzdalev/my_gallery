import InfoPage from '@/components/info/InfoPage'

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy"
      description="Краткая информация о приватности в учебном проекте Creative Archive."
      sections={[
        {
          title: 'Аккаунт',
          text: 'Для входа и регистрации используется Supabase Auth. Пароли не хранятся в интерфейсе приложения.',
        },
        {
          title: 'Данные профиля',
          text: 'Имя, аватар, bio и опубликованные работы используются для отображения публичного профиля автора.',
        },
      ]}
    />
  )
}
