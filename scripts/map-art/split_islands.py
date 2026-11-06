"""Split a sky-island tile into a still sky and separate floating islands.

out/<name>-sky.webp    the tile with the islands taken out and the holes filled with sky (push-pull fill)
out/<name>-land.webp   the islands (and their bridges) on transparency
out/<name>-cells.json  one cell per island: a polygon (tile px) that the island and its share of the
                       bridges fall in, plus the island's centre; cells tile the plane without overlap
usage: python -I split_islands.py <tile.webp> <out_dir> <name>
"""
import sys, os, json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def fill_small_holes(m, limit=70000):
    """Fill holes inside the land (blossoms, waterfalls) but never the open sky a ring of islands encloses."""
    holes = ndi.binary_fill_holes(m) & ~m
    lab, n = ndi.label(holes)
    if n == 0:
        return m
    sizes = ndi.sum(holes, lab, range(1, n + 1))
    return m | np.isin(lab, 1 + np.where(sizes < limit)[0])

SRC, OUT, NAME = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGB')
A = np.array(im).astype(float)
H, W, _ = A.shape
r, g, b = A[..., 0], A[..., 1], A[..., 2]
mx, mn = A.max(-1), A.min(-1)
sat = (mx - mn) / np.maximum(mx, 1)
val = mx / 255

# --- sky palette from the cloud bands along the top and bottom edges
samples = np.concatenate([A[:24].reshape(-1, 3), A[-24:].reshape(-1, 3), A[:, :30].reshape(-1, 3), A[:, -30:].reshape(-1, 3)])
rng = np.random.default_rng(0)
samples = samples[rng.choice(len(samples), 6000, replace=False)]
K = 12
cent = samples[rng.choice(len(samples), K, replace=False)]
for _ in range(25):
    d = ((samples[:, None, :] - cent[None]) ** 2).sum(-1)
    lab = d.argmin(1)
    cent = np.array([samples[lab == k].mean(0) if (lab == k).any() else cent[k] for k in range(K)])
flat = A.reshape(-1, 3)
dmin = np.full(len(flat), 1e9)
for c in cent:
    dmin = np.minimum(dmin, ((flat - c) ** 2).sum(-1))
dsky = np.sqrt(dmin).reshape(H, W)

# --- land evidence: far from every sky colour, green vegetation, dark rock/wood, warm brown
green = (g > r + 6) & (g > b + 6) & (sat > 0.22)
dark = val < 0.5
brown = (r > b + 25) & (g > b + 8) & (sat > 0.25) & (val < 0.85)
land = (dsky > 38) | green | dark | brown
land = ndi.binary_opening(land, iterations=2)
land = ndi.binary_closing(land, iterations=4)
land = fill_small_holes(land)
lab, n = ndi.label(land)
sizes = ndi.sum(land, lab, range(1, n + 1))
land = np.isin(lab, 1 + np.where(sizes > 900)[0])
land = fill_small_holes(ndi.binary_closing(land, iterations=3))
# undersides and props: near the land (and especially below it) take anything that is not plain sky
below = np.zeros_like(land)
for dy in range(0, 90, 6):
    below[dy:] |= land[:H - dy]
near = ndi.binary_dilation(land, iterations=26) | below
land |= near & ((dsky > 22) | (val < 0.74) | brown)
land = ndi.binary_closing(land, iterations=4)
land = fill_small_holes(land)
lab2, n2 = ndi.label(land)
sizes2 = ndi.sum(land, lab2, range(1, n2 + 1))
land = np.isin(lab2, 1 + np.where(sizes2 > 900)[0])
# soft edge: grow 2 px, feather
alpha = ndi.gaussian_filter(ndi.binary_dilation(land, iterations=2).astype(float), 1.4)
alpha = np.clip(alpha * 1.25, 0, 1)

# --- islands: the thick bodies are the islands; bridges and props go to the nearest body
dt = ndi.distance_transform_edt(land)
# one marker per island body (the peaks of the distance map), then a watershed over the land: touching
# islands are split along their narrowest connection, which is the bridge between them
peaks = (dt == ndi.maximum_filter(dt, size=95)) & (dt > 24)
markers, n = ndi.label(ndi.binary_dilation(peaks, iterations=4))
# two peaks on one island body (a long island has more than one) are one marker: the straight line
# between them stays thick, while between two islands it drops to a bridge
cen = ndi.center_of_mass(peaks, markers, range(1, n + 1))
val = [dt[int(round(cy)), int(round(cx))] for cy, cx in cen]
parent = list(range(n + 1))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
for i in range(n):
    for j in range(i + 1, n):
        (y1, x1), (y2, x2) = cen[i], cen[j]
        L = math.hypot(x2 - x1, y2 - y1)
        if L > 420:
            continue
        s = np.linspace(0, 1, max(2, int(L / 3)))
        line = dt[np.round(y1 + (y2 - y1) * s).astype(int), np.round(x1 + (x2 - x1) * s).astype(int)]
        if line.min() >= 0.62 * min(val[i], val[j]):
            parent[find(i + 1)] = find(j + 1)
roots = {}
remap = np.zeros(n + 1, np.int32)
for k in range(1, n + 1):
    remap[k] = roots.setdefault(find(k), len(roots) + 1)
markers = remap[markers]
n = len(roots)
# grow the markers down the distance map, level by level: thick parts first, bridges last, so two
# islands meet in the middle of the bridge between them
lab = markers.copy()
for level in np.arange(dt.max(), 0.5, -1.5):
    allowed = land & (dt >= level)
    comp, nc = ndi.label(allowed)
    have = lab > 0
    if not have.any() or nc == 0:
        continue
    pairs = np.unique(np.stack([comp[have], lab[have]], 1), axis=0)
    pairs = pairs[pairs[:, 0] > 0]
    cnt = np.bincount(pairs[:, 0], minlength=nc + 1)
    single = np.zeros(nc + 1, lab.dtype)
    one = pairs[cnt[pairs[:, 0]] == 1]
    single[one[:, 0]] = one[:, 1]
    fill = (lab == 0) & allowed & (single[comp] > 0)
    lab[fill] = single[comp][fill]
    multi = np.where(cnt > 1)[0]
    if len(multi):
        zone = np.isin(comp, multi)
        for _ in range(500):                           # several islands in one piece: grow them together
            grown = ndi.grey_dilation(lab, size=3)
            new = (lab == 0) & zone & (grown > 0)
            if not new.any():
                break
            lab[new] = grown[new]
for _ in range(400):                                   # finish the long thin ends
    grown = ndi.grey_dilation(lab, size=3)
    new = (lab == 0) & land & (grown > 0)
    if not new.any():
        break
    lab[new] = grown[new]
# small separate pieces of land with no island body (little rocks, kites) are islands of their own
comp, nc = ndi.label(land)
for k in range(1, nc + 1):
    m = comp == k
    if not (lab[m] > 0).any():
        n += 1
        lab[m] = n
dist, (iy, ix) = ndi.distance_transform_edt(lab == 0, return_indices=True)
cells = lab[iy, ix]
# Islands that cross the tile's top or bottom edge carry on into the next tile: they stay in the painting,
# whole and still (not cut out), so the join between tiles is exactly as painted.
crossing = set(np.unique(cells[:18][land[:18]])) | set(np.unique(cells[-18:][land[-18:]]))
crossing.discard(0)
fixed = np.isin(cells, list(crossing)) & land
alpha = alpha * ~np.isin(cells, list(crossing))

# --- every island cut out into a sprite sheet (exact pixels, so no two islands ever draw the same pixel)
pieces = []
for k in range(1, n + 1):
    am = alpha * (cells == k)
    ys, xs = np.nonzero(am > 0.01)
    if len(ys) < 200:
        continue
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = np.dstack([A[y0:y1, x0:x1], am[y0:y1, x0:x1] * 255])
    cy, cx = np.average(np.nonzero(cells == k), axis=1, weights=None) if False else (ys.mean(), xs.mean())
    pieces.append({'k': k, 'box': [int(x0), int(y0), int(x1), int(y1)], 'crop': crop, 'centre': [round(float(cx), 1), round(float(cy), 1)]})
pieces.sort(key=lambda p: -(p['box'][3] - p['box'][1]))
AW, pad = 2048, 2
x = y = shelf = 0
for p in pieces:
    w, h = p['box'][2] - p['box'][0], p['box'][3] - p['box'][1]
    if x + w > AW:
        x, y, shelf = 0, y + shelf + pad, 0
    p['at'] = [x, y]
    x += w + pad
    shelf = max(shelf, h)
AH = y + shelf
atlas = np.zeros((AH, AW, 4))
for p in pieces:
    (ax, ay), (x0, y0, x1, y1) = p['at'], p['box']
    atlas[ay:ay + (y1 - y0), ax:ax + (x1 - x0)] = p['crop']
Image.fromarray(atlas.clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{NAME}-islands.webp'), quality=88, method=6)
info = [{'box': p['box'], 'at': p['at'], 'centre': p['centre']} for p in pieces]

# --- the sky with the islands taken out: push-pull fill of the holes
hole = alpha > 0.02
# where two islands' cells meet (that is, across the bridges between them) keep the painting in the
# still sky as well, so if the two halves drift a little apart the bridge underneath fills the gap
seam = np.zeros((H, W), bool)
seam[:, 1:] |= cells[:, 1:] != cells[:, :-1]
seam[1:, :] |= cells[1:, :] != cells[:-1, :]
yy0, xx0 = np.mgrid[-10:11, -10:11]
disk = xx0 ** 2 + yy0 ** 2 <= 100
thin = land & ~ndi.binary_opening(land, structure=disk)           # bridges, stairs, ropes; not island bodies
seam = ndi.binary_dilation(seam, iterations=16) & thin
hole &= ~seam
def pushpull(img, valid):
    levels = [(img * valid[..., None], valid.astype(float))]
    while min(levels[-1][1].shape) > 4:
        c, w = levels[-1]
        h2, w2 = c.shape[0] // 2 * 2, c.shape[1] // 2 * 2
        c2 = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3))
        ww = w[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
        levels.append((c2, ww))
    up = levels[-1][0] / np.maximum(levels[-1][1], 1e-6)[..., None]
    for c, w in reversed(levels[:-1]):
        upk = np.repeat(np.repeat(up, 2, 0), 2, 1)
        upk = np.pad(upk, ((0, c.shape[0] - upk.shape[0]), (0, c.shape[1] - upk.shape[1]), (0, 0)), mode='edge')
        here = c / np.maximum(w, 1e-6)[..., None]
        wt = np.clip(w, 0, 1)[..., None]
        up = here * wt + upk * (1 - wt)
        up = ndi.gaussian_filter(up, (1, 1, 0))
    return up
filled = pushpull(A, ~hole)
sky = np.where(hole[..., None], filled, A)
sky = ndi.gaussian_filter(sky, (0.6, 0.6, 0)) * hole[..., None] + A * (~hole[..., None])
Image.fromarray(sky.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, f'{NAME}-sky.webp'), quality=86, method=6)
# island index per pixel (1-based, in the order of `islands`), so a stone circle can find its island
order = {p['k']: i + 1 for i, p in enumerate(pieces)}
lut = np.zeros(n + 1, np.uint8)
for k, i in order.items():
    lut[k] = i
Image.fromarray(lut[cells]).save(os.path.join(OUT, f'{NAME}-cellmap.png'))
json.dump({'w': W, 'h': H, 'atlas': [AW, AH], 'islands': info}, open(os.path.join(OUT, f'{NAME}-islands.json'), 'w'))
rng2 = np.random.default_rng(1)
col = rng2.integers(60, 255, (n + 1, 3)); col[0] = 0
pv = (A * 0.45 + col[cells] * 0.55) * (alpha[..., None] > 0.3) + A * (alpha[..., None] <= 0.3) * 0.3
Image.fromarray(pv.clip(0, 255).astype(np.uint8)).resize((W // 2, H // 2)).save(os.path.join(OUT, f'{NAME}-preview-cells.jpg'), quality=85)
Image.fromarray(sky.clip(0, 255).astype(np.uint8)).resize((W // 2, H // 2)).save(os.path.join(OUT, f'{NAME}-preview-sky.jpg'), quality=85)
print(NAME, 'islands', len(info), 'atlas', AW, AH, 'kept still (cross the edge):', len(crossing))
