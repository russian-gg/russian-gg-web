import { Lamp, Skyline, Tree } from './scenery'
import { ZONE_BUILDINGS } from './scenery-sets'
import type { MissionZone } from './zones'

/**
 * A whole little street for the mission panel, standing in for a mission's own illustration
 * until one is delivered: sky, rooftops, ground, and two of the zone's buildings with a tree.
 */
export function ZoneScene({ zone, className }: { zone: MissionZone; className?: string }) {
  const [First, Second] = [ZONE_BUILDINGS[zone][0], ZONE_BUILDINGS[zone][1] ?? ZONE_BUILDINGS[zone][0]]
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" className={className}>
      <rect width={400} height={300} className="fill-signal-soft" />
      <circle cx={330} cy={64} r={26} className="fill-caution-soft" />
      <Skyline x={0} y={110} width={400} height={110} />
      <rect y={226} width={400} height={74} className="fill-milestone-soft" />
      <rect y={240} width={400} height={20} className="fill-ground-raised/70" />
      <First x={28} y={118} width={170} height={142} />
      <Second x={210} y={118} width={170} height={142} />
      <Tree x={170} y={176} width={56} height={84} />
      <Lamp x={366} y={196} width={22} height={64} />
    </svg>
  )
}
