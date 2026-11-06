import deskL from '../../assets/images/clouds/desk-l.webp'
import deskL2 from '../../assets/images/clouds/desk-l2.webp'
import deskR from '../../assets/images/clouds/desk-r.webp'
import deskR2 from '../../assets/images/clouds/desk-r2.webp'
import phoneL from '../../assets/images/clouds/phone-l.webp'
import phoneL2 from '../../assets/images/clouds/phone-l2.webp'
import phoneR from '../../assets/images/clouds/phone-r.webp'
import phoneR2 from '../../assets/images/clouds/phone-r2.webp'
import './map.css'

/**
 * The map opens out of the clouds: a mist, then two banks of cumulus that part from the middle
 * to the sides — a bigger, nearer pair first, then the pair behind it — so the picture seems to
 * appear out of the sky. The clouds are painted for each screen shape, so the puffs keep their
 * size on a phone. Decoration only: hidden from assistive technology and never in the way of a
 * click.
 */
export function CloudCurtain({ roomy }: { roomy: boolean }) {
  const [l, r, l2, r2] = roomy ? [deskL, deskR, deskL2, deskR2] : [phoneL, phoneR, phoneL2, phoneR2]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4500] overflow-hidden">
      <div className="curtain-veil" />
      <span className="curtain-cloud curtain-back curtain-l" style={{ backgroundImage: `url(${l})` }} />
      <span className="curtain-cloud curtain-back curtain-r" style={{ backgroundImage: `url(${r})` }} />
      <span className="curtain-cloud curtain-front curtain-l" style={{ backgroundImage: `url(${l2})` }} />
      <span className="curtain-cloud curtain-front curtain-r" style={{ backgroundImage: `url(${r2})` }} />
    </div>
  )
}
