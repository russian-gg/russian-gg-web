import type { ReactNode } from 'react'

/**
 * A translated sentence with emphasis in it.
 *
 * The lesson screens were written as JSX with `<strong>` in the middle of the prose, which
 * meant a paragraph arrived at the dictionary as five fragments — and a fragment is not a
 * translatable unit: word order moves, so "Words ending in *-й* belong to…" cannot be
 * reassembled from its pieces in another language.
 *
 * So the whole sentence goes in the dictionary with `*asterisks*` around the emphasis, and
 * this puts the markup back. A translator moves the asterisks with the words.
 *
 * Deliberately just the one mark. This is not a Markdown renderer and must not become one:
 * anything that needs more structure than a bolded run is a piece of layout, and layout
 * belongs in the component.
 */
export function Rich({ text, className }: { text: string; className?: string }) {
  const parts = text.split('*')

  return (
    <>
      {parts.map((part, index) =>
        // Odd indices are what sat between a pair of asterisks.
        index % 2 === 1 ? (
          <strong key={index} className={className}>
            {part}
          </strong>
        ) : (
          (part as ReactNode)
        ),
      )}
    </>
  )
}
