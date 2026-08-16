export function missionCardClass(completed: boolean, locked = false) {
  return [
    'flex min-h-44 flex-col rounded-[var(--radius-card)] border p-5',
    'transition-[border-color,box-shadow,transform] duration-150',
    completed
      ? 'border-milestone/15 bg-milestone-soft/55'
      : 'border-hairline bg-ground-raised',
    locked
      ? 'opacity-75 hover:border-caution/40'
      : 'hover:-translate-y-0.5 hover:border-signal/55 hover:shadow-[0_8px_24px_rgb(22_24_29/0.06)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2',
  ].join(' ')
}
