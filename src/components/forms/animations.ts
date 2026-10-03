/**
 * shadcn/ui's floating-layer animation, word for word: fade and scale in from the side the
 * layer opens on, and the reverse on the way out. Radix sets `data-state` and `data-side`;
 * `tw-animate-css` (imported in `styles.css`) supplies the keyframes.
 */
export const floatingLayerAnimation =
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 ' +
  'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 ' +
  'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 ' +
  'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2'

/** The frame every floating layer shares: raised surface, hairline edge, card corners. */
export const floatingLayerFrame =
  'z-[60] overflow-hidden rounded-2xl border border-hairline bg-ground-raised text-ink shadow-xl'
