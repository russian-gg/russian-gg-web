import townArt from '../../assets/images/missionBg.webp'

/**
 * The town the mission road runs through, filling the screen behind the road and staying put
 * while the road scrolls over it.
 *
 * It starts where the road starts (`top`, measured by the page), not at the top of the screen:
 * the page heading stays on the plain page, and the town fades in under it through a long
 * soft edge. Its sides fade out the same way, so it never shows a hard border.
 *
 * `fixed`, from the sidebar's edge to the right of the screen: the sidebar is the app's, and
 * the picture stops where it begins. On a phone there is no sidebar; the top bar and the tab
 * bar sit above it on their own layers. It has no z-index of its own and comes before the page
 * in the tree, so the page — given `relative` by the caller — paints over it in order.
 *
 * Only lightly washed — densest at the top where it meets the page — so the town stays a
 * town. Contrast for the missions is added where they are (the map lays a soft pool of light
 * under each node and title), not by fading the whole picture. The dark theme washes it
 * further.
 */
export function TownBackdrop({ top }: { top: number | null }) {
  if (top === null) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-0 bottom-0 left-0 overflow-hidden [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent,black_200px),linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] md:left-[15.5rem]"
      style={{ top }}
    >
      <img
        src={townArt}
        alt=""
        width={1737}
        height={905}
        decoding="async"
        className="size-full object-cover select-none"
      />
      <div className="absolute inset-0 bg-linear-to-b from-ground-sunken/60 via-ground-sunken/15 via-30% to-ground-sunken/20 [[data-theme=dark]_&]:from-ground/85 [[data-theme=dark]_&]:via-ground/60 [[data-theme=dark]_&]:to-ground/65" />
    </div>
  )
}
