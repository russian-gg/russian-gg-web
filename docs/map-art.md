# Map art: how the pictures behind the two maps are made

The missions road (`/practice`) and the 90-day sky (`/path`) are illustrated maps. The paintings
are AI-generated; everything else here is made from them by the scripts in `scripts/map-art/`
(Python 3 with Pillow, NumPy and SciPy). Run them with `python -I` from the repository root.

## The cloud curtain (both maps)

Two banks of cumulus that part when a map opens (`src/components/map/CloudCurtain.tsx`). They
are rendered, not painted, so each screen shape gets clouds whose puffs keep their size:

```
python -I scripts/map-art/make_clouds.py <out-dir> 1600 1020 desk 0.95
python -I scripts/map-art/make_clouds.py <out-dir> 720 1240 phone 0.75
```

Each run writes `<prefix>-l`, `-r`, `-l2`, `-r2` `.webp` (the back and the front pair); copy
them to `src/assets/images/clouds/`.

## The missions road

`src/assets/images/mission-road.webp` is one tile, repeated upwards. The missions stand on its
clearings (`SLOTS` in `MissionMap.tsx`, measured by hand). The cars drive the road's centre line,
traced from the picture:

```
python -I scripts/map-art/trace_road.py src/assets/images/mission-road.webp <out.json>
```

The points go into `ROAD` in `src/components/missions/road-life.tsx`. Redraw the road, trace it again.

## The 90-day sky

Two paintings of floating islands (each also used mirrored). Their cloud bands at the top and
bottom edge were blended so any one joins any other. To let the islands float one by one, each
painting is split into a still sky and the islands cut out on transparency:

```
python -I scripts/map-art/split_islands.py <painting.webp> <out-dir> a
python -I scripts/map-art/split_islands.py <painting.webp> <out-dir> c
```

That writes `<name>-sky.webp` (the painting with the islands taken out and the gaps filled with
sky), `<name>-islands.webp` (every island in one sprite sheet), `<name>-islands.json` (each
island's box in the painting and its place in the sheet) and `<name>-cellmap.png` (which island
each pixel belongs to). The `.webp` files go to `src/assets/images/sky/`; the JSON and the cell
map are turned into `src/components/path/sky-islands.ts` (the island list, and for each stone
circle a day stands on, the island it belongs to).

What the split does, in short:

- Land is told from sky by colour (far from every sky colour, green, dark rock, warm wood),
  then widened downwards to take each island's rocky underside and the props beside it.
- Islands are split along their narrowest connections, so neighbours part in the middle of
  the bridge between them; a long island with two bodies stays one.
- Islands that cross the painting's top or bottom edge carry on into the next painting: they
  stay in the painting, whole and still, so the joins look exactly as painted.
- Where two islands meet across a bridge, the bridge is kept in the still sky as well, so if
  the halves drift slightly apart the bridge underneath fills the gap.

The drifting cumulus over the islands is rendered too:

```
python -I scripts/map-art/make_puffs.py <out-dir>
```

(`puff-1..3.webp`, to `src/assets/images/sky/`).
