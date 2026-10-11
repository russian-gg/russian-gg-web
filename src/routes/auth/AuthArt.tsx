/** The product's icon: a rounded blue tile with the wordmark's own two letters. */
export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[28%] bg-signal-ink text-white ${className}`}
    >
      {/* Sized from the tile rather than fixed, so one `className` scales the whole mark. */}
      <span className="text-[0.62em] leading-none font-extrabold tracking-[-0.04em]">gg</span>
    </span>
  )
}
