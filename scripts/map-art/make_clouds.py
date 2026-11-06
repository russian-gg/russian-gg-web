"""Render two cumulus cloud banks (left / right half of a curtain) as RGBA webp.

Each bank fills one side of the image and ends in a billowy cumulus edge facing the middle.
Silhouette: soft puffs (soft union) whose outline is eaten by fractal noise.
Shading: a height field from the blurred density, lit from above, cool lilac shadows in the folds."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT, W, H, PREFIX, PS = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], float(sys.argv[5])   # PS: puff size factor


def fbm(shape, seed, octaves=6, base=4, gain=0.55):
    rng = np.random.default_rng(seed)
    out = np.zeros(shape)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        small = rng.random((n + 3, n + 3)).astype(np.float32)
        big = np.array(Image.fromarray(small, 'F').resize((shape[1], shape[0]), Image.BICUBIC), float)
        out += amp * big
        tot += amp
        amp *= gain
    return out / tot


def bank(seed):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    r1 = np.random.default_rng(seed + 7)
    e, amp, tot = np.zeros(H), 1.0, 0.0
    for o in range(4):                                          # 1-D fractal noise down the height
        k = 3 * 2 ** o
        pts = r1.random(k + 2)
        e += amp * np.interp(np.linspace(0, k + 1, H), np.arange(k + 2), pts)
        tot += amp
        amp *= 0.55
    e = ndi.gaussian_filter1d(e / tot, 12)
    e = (e - e.min()) / (e.max() - e.min())
    edge = W * (0.66 + 0.24 * (e - 0.5))                       # always past the middle, so a closed pair has no gap                        # where the bank ends, per row
    K = 0.06                                                    # smooth-max sharpness between puffs
    acc = np.full((H, W), 1e-9)
    # the far side is one thick mass, so the left edge of the image is always covered
    base = ndi.gaussian_filter(np.clip(edge[:, None] - 240 - xx, 0, None), 40)
    acc += np.where(base > 1, np.exp(K * np.minimum(base * 0.35, 70)), 0)

    def puff(cx, cy, r, lift):
        x0, x1 = int(max(0, cx - r)), int(min(W, cx + r + 1))
        y0, y1 = int(max(0, cy - r)), int(min(H, cy + r + 1))
        if x0 >= x1 or y0 >= y1:
            return
        d2 = (xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2
        h = np.sqrt(np.clip(r * r - d2, 0, None))
        m = h > 0
        acc[y0:y1, x0:x1][m] += np.exp(K * (h[m] * 0.85 + lift))

    # big billows first, then smaller ones crowding the edge
    for n, (rlo, rhi, depth) in ((70, (130, 230, 520)), (160, (60, 130, 260)), (220, (25, 60, 90))):
        for _ in range(int(n * W / 1000 * H / 1150)):
            cy = rng.uniform(-120, H + 120)
            ex = edge[int(np.clip(cy, 0, H - 1))]
            inward = abs(rng.normal(0, depth * PS / 2 * max(1, W / 1000)))
            r = rng.uniform(rlo, rhi) * PS
            cx = ex - r * 0.6 - inward + (rng.normal(0, r * 0.3) if rlo < 100 else 0)
            puff(cx, cy, r, min(60, inward * 0.15))
    hgt = np.log(acc) / K
    hgt = np.where(hgt < 0, 0, hgt)
    hgt = ndi.gaussian_filter(hgt, 7)                          # rounder, softer puffs
    n1 = fbm((H, W), seed + 1, octaves=5, base=6)
    n2 = fbm((H, W), seed + 2, octaves=5, base=26)
    hgt = hgt + 5 * (n1 - 0.5) + 1 * (n2 - 0.5)
    alpha = np.clip((hgt - 4) / 34, 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    hs = ndi.gaussian_filter(hgt, 4)
    gy, gx = np.gradient(hs)
    norm = np.sqrt(gx * gx + gy * gy + 1)
    L = np.array([0.15, -0.75, 0.64])
    diffuse = np.clip((-gx * L[0] - gy * L[1] + L[2]) / norm, 0, 1)
    occl = np.clip((ndi.gaussian_filter(hs, 22) - hs) / 40, 0, 1)        # puffs sunk between neighbours are shaded
    shade = np.clip(0.45 + 0.6 * diffuse - 0.3 * occl, 0, 1)
    light = np.array([255, 255, 255], float)
    mid = np.array([241, 238, 251], float)
    dark = np.array([208, 202, 234], float)
    s = shade[..., None]
    rgb = np.where(s > 0.6, mid + (light - mid) * (s - 0.6) / 0.4, dark + (mid - dark) * s / 0.6)
    return np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)


os.makedirs(OUT, exist_ok=True)
left = bank(11)
right = bank(29)[:, ::-1].copy()
ims = {'l': left, 'r': right, 'l2': right[:, ::-1].copy(), 'r2': left[:, ::-1].copy()}
for k, im in ims.items():
    Image.fromarray(im, 'RGBA').save(os.path.join(OUT, f'{PREFIX}-{k}.webp'), quality=85, method=6)
for gap, name in ((0, 'closed'), (int(W * 0.5), 'open')):
    bg = Image.new('RGBA', (W + gap, H), (150, 140, 200, 255))
    bg.alpha_composite(Image.fromarray(left, 'RGBA'), (0, 0))
    bg.alpha_composite(Image.fromarray(right, 'RGBA'), (gap, 0))
    bg.convert('RGB').resize(((W + gap) // 3, H // 3)).save(os.path.join(OUT, f'{PREFIX}-preview-{name}.jpg'))
print('ok', PREFIX)
