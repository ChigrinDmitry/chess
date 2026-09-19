import { useEffect, useState, type ReactNode } from 'react'
import { ThemeSwitcher } from '@/features/switch-theme'
import {
  GlassAvatar,
  GlassButton,
  GlassInput,
  GlassModal,
  GlassPanel,
  GlassSegmentedControl,
  type SegmentedOption,
} from '@/shared/ui'
import { BoardSample } from './BoardSample'
import { PieceGallery } from './PieceGallery'
import styles from './KitPage.module.css'

type GlassMode = 'glass' | 'solid'

const GLASS_OPTIONS: readonly SegmentedOption<GlassMode>[] = [
  { value: 'glass', label: 'Стекло' },
  { value: 'solid', label: 'Плотное' },
]

const TIME_OPTIONS = [
  { value: 'blitz', label: '3+2' },
  { value: 'five', label: '5+0' },
  { value: 'rapid', label: '10+0' },
  { value: 'none', label: 'Без часов', disabled: true },
] as const

const AVATARS = ['Смелый конь', 'Хитрая ладья', 'Быстрый слон', 'Тихий король', 'Ferz', 'e4']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassPanel as="section" padding="lg" className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </GlassPanel>
  )
}

export function KitPage() {
  const [glassMode, setGlassMode] = useState<GlassMode>('glass')
  const [time, setTime] = useState<(typeof TIME_OPTIONS)[number]['value']>('five')
  const [nick, setNick] = useState('Смелый конь')
  const [modalOpen, setModalOpen] = useState(false)

  // Ручное «плотное стекло» — тот же путь, что у prefers-reduced-transparency
  useEffect(() => {
    if (glassMode === 'solid') document.documentElement.dataset.glass = 'solid'
    else delete document.documentElement.dataset.glass
    return () => {
      delete document.documentElement.dataset.glass
    }
  }, [glassMode])

  return (
    <main className={styles.page}>
      <GlassPanel as="header" padding="sm" radius="xl" className={styles.toolbar}>
        <h1 className={styles.title}>UI Kit</h1>
        <div className={styles.toolbarControls}>
          <ThemeSwitcher />
          <GlassSegmentedControl
            label="Режим стекла"
            value={glassMode}
            options={GLASS_OPTIONS}
            onChange={setGlassMode}
          />
        </div>
      </GlassPanel>

      <div className={styles.grid}>
        <Section title="Кнопки">
          <div className={styles.row}>
            <GlassButton variant="primary">Играть</GlassButton>
            <GlassButton>Вторичная</GlassButton>
            <GlassButton variant="ghost">Прозрачная</GlassButton>
            <GlassButton variant="danger">Сдаться</GlassButton>
          </div>
          <div className={styles.row}>
            <GlassButton variant="primary" size="sm">
              Малая
            </GlassButton>
            <GlassButton variant="primary" size="lg">
              Крупная
            </GlassButton>
            <GlassButton variant="primary" disabled>
              Недоступна
            </GlassButton>
            <GlassButton disabled>Недоступна</GlassButton>
          </div>
        </Section>

        <Section title="Сегментный переключатель">
          <GlassSegmentedControl
            label="Контроль времени"
            value={time}
            options={TIME_OPTIONS}
            onChange={setTime}
          />
          <p className={styles.muted}>Выбрано: {time}</p>
        </Section>

        <Section title="Поле ввода">
          <GlassInput
            label="Ник"
            value={nick}
            maxLength={24}
            hint="До 24 символов"
            onChange={(event) => setNick(event.target.value)}
          />
          <GlassInput label="С ошибкой" defaultValue="" placeholder="Пусто" error="Введите ник" />
          <GlassInput label="Отключено" defaultValue="Недоступно" disabled />
        </Section>

        <Section title="Аватары">
          <div className={styles.row}>
            <GlassAvatar name="Смелый конь" size="sm" />
            <GlassAvatar name="Смелый конь" size="md" />
            <GlassAvatar name="Смелый конь" size="lg" />
          </div>
          <div className={styles.row}>
            {AVATARS.map((name) => (
              <GlassAvatar key={name} name={name} />
            ))}
          </div>
        </Section>

        <Section title="Панели">
          <div className={styles.row}>
            <GlassPanel padding="md" radius="md">
              Обычная
            </GlassPanel>
            <GlassPanel padding="md" radius="md" strong>
              Плотная
            </GlassPanel>
          </div>
          <p className={styles.muted}>Вторичный текст на стекле: проверка контраста.</p>
        </Section>

        <Section title="Модальное окно">
          <GlassButton variant="primary" onClick={() => setModalOpen(true)}>
            Открыть модалку
          </GlassButton>
        </Section>

        <Section title="Палитра доски">
          <BoardSample />
        </Section>

        <Section title="Фигуры">
          <PieceGallery />
        </Section>
      </div>

      <GlassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Партия окончена"
        footer={
          <>
            <GlassButton onClick={() => setModalOpen(false)}>Новая игра</GlassButton>
            <GlassButton variant="primary" onClick={() => setModalOpen(false)}>
              Реванш
            </GlassButton>
          </>
        }
      >
        <p>Мат. Белые победили в 34 хода.</p>
      </GlassModal>
    </main>
  )
}
