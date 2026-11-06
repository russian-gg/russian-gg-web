"""Trace the road's centre line in the missions road picture, for the cars on the map.

usage: python -I trace_road.py <mission-road.webp> <out.json>
Starts from a rough route placed by hand along the road (bottom edge to top edge), then at
every step finds the middle of the asphalt across the road and smooths the result. Both ends
are put at the same x, so the line carries on into the next copy of the picture.
The result goes into `ROAD` in `src/components/missions/road-life.tsx`.
"""
import sys, json, math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
HAND = [(887, 851), (853, 787), (800, 727), (720, 687), (600, 660), (440, 637), (267, 607), (160, 567), (127, 520),
        (153, 473), (227, 447), (347, 437), (533, 453), (667, 493), (800, 547), (933, 557), (1027, 533), (1107, 480),
        (1173, 427), (1280, 387), (1413, 360), (1507, 333), (1547, 280), (1533, 213), (1467, 160), (1333, 133),
        (1200, 133), (1067, 153), (933, 200), (800, 247), (640, 267), (467, 280), (333, 267), (280, 220), (307, 160),
        (400, 133), (560, 133), (720, 107), (813, 67), (867, 20), (887, 0)]

im = Image.open(SRC).convert('RGB')
A = np.array(im).astype(int); mx = A.max(-1); mn = A.min(-1)
mask = ((mx - mn) < 30) & (mx > 60) & (mx < 185) | ((mn > 200))         # asphalt + the white dashes
mask = ndi.binary_opening(mask, iterations=2)
mask = ndi.binary_closing(mask, iterations=5)
lab, n = ndi.label(mask)
sizes = ndi.sum(mask, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.argsort(sizes)[-4:])
dt = ndi.distance_transform_edt(keep)
H, W = dt.shape
# dense resample of the hand route
P = np.array(HAND, float)
seg = np.cumsum([0] + [math.dist(P[i], P[i + 1]) for i in range(len(P) - 1)])
s = np.arange(0, seg[-1], 6.0)
pts = np.c_[np.interp(s, seg, P[:, 0]), np.interp(s, seg, P[:, 1])]
out = []
for k in range(len(pts)):
    p = pts[k]
    q0, q1 = pts[max(0, k - 3)], pts[min(len(pts) - 1, k + 3)]
    d = q1 - q0; d /= (np.linalg.norm(d) or 1)
    nrm = np.array([-d[1], d[0]])
    best, bv = p, -1
    for t in np.arange(-70, 71, 1.0):
        q = p + t * nrm
        x, y = int(round(q[0])), int(round(q[1]))
        if 0 <= x < W and 0 <= y < H:
            v = dt[y, x] - abs(t) * 0.02            # prefer the nearest ridge
            if v > bv:
                bv, best = v, q
    out.append(best)
out = np.array(out)
# smooth along the line, keep the ends
sm = out.copy()
for _ in range(3):
    sm[3:-3] = np.array([sm[i - 3:i + 4].mean(0) for i in range(3, len(sm) - 3)])
sm[0] = [sm[0][0], H]; sm[-1] = [sm[0][0], 0]                       # same x at both ends, so tiles join
sm[1] = (sm[0] + sm[2]) / 2; sm[-2] = (sm[-1] + sm[-3]) / 2
pts2 = [tuple(map(float, p)) for p in sm[::4]] + [tuple(map(float, sm[-1]))]
half = np.median([dt[int(min(H - 1, max(0, y))), int(min(W - 1, max(0, x)))] for x, y in sm[5:-5]])
json.dump({'centre': [(round(x), round(y)) for x, y in pts2], 'half': float(half)}, open(OUT, 'w'))
print(len(pts2), 'points; road half-width', round(float(half), 1))
