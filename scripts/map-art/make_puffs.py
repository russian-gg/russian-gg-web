"""Render single drifting cumulus clouds (flat base, billowy dome), same lighting as the curtain clouds."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = sys.argv[1]
W, H = 720, 300


def fbm(shape, seed, octaves=5, base=5, gain=0.55):
    rng = np.random.default_rng(seed)
    out = np.zeros(shape)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        small = rng.random((n + 3, n + 3)).astype(np.float32)
        out += amp * np.array(Image.fromarray(small, 'F').resize((shape[1], shape[0]), Image.BICUBIC), float)
        tot += amp
        amp *= gain
    return out / tot


def cloud(seed, flat=0.72, spread=0.36):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    K = 0.06
    acc = np.full((H, W), 1e-9)

    def puff(cx, cy, r, lift=0.0):
        x0, x1 = int(max(0, cx - r)), int(min(W, cx + r + 1))
        y0, y1 = int(max(0, cy - r)), int(min(H, cy + r + 1))
        if x0 >= x1 or y0 >= y1:
            return
        d2 = (xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2
        h = np.sqrt(np.clip(r * r - d2, 0, None))
        m = h > 0
        acc[y0:y1, x0:x1][m] += np.exp(K * (h[m] * 0.85 + lift))

    base_y = H * flat
    # a row of balls along the base, a dome of balls on top, small ones on the shoulders
    for i in range(9):
        t = (i + rng.uniform(-0.3, 0.3)) / 8
        x = W * (0.5 + (t - 0.5) * 2 * spread * 0.95)
        r = H * rng.uniform(0.13, 0.2) * (1 - abs(t - 0.5))
        puff(x, base_y - r * 0.6, r + 18)
    for i in range(6):
        t = rng.uniform(0.2, 0.8)
        x = W * (0.5 + (t - 0.5) * 2 * spread * 0.8)
        r = H * rng.uniform(0.16, 0.28) * (1.25 - abs(t - 0.5) * 1.4)
        puff(x, base_y - r * 1.15, r, 10)
    for i in range(10):
        t = rng.uniform(0.05, 0.95)
        x = W * (0.5 + (t - 0.5) * 2 * spread)
        r = H * rng.uniform(0.06, 0.11)
        puff(x, base_y - H * rng.uniform(0.1, 0.45) * (1 - abs(t - 0.5) * 1.3), r)
    hgt = np.log(acc) / K
    hgt = np.where(hgt < 0, 0, hgt)
    hgt = ndi.gaussian_filter(hgt, 5)
    n1 = fbm((H, W), seed + 1)
    hgt = hgt + 5 * (n1 - 0.5)
    alpha = np.clip((hgt - 4) / 30, 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    # flat, slightly hazy base
    base = np.clip((base_y + 20 - yy) / 42, 0, 1)
    alpha *= base
    hs = ndi.gaussian_filter(hgt, 4)
    gy, gx = np.gradient(hs)
    norm = np.sqrt(gx * gx + gy * gy + 1)
    L = np.array([0.15, -0.75, 0.64])
    diffuse = np.clip((-gx * L[0] - gy * L[1] + L[2]) / norm, 0, 1)
    occl = np.clip((ndi.gaussian_filter(hs, 18) - hs) / 40, 0, 1)
    under = np.clip((yy - (base_y - H * 0.18)) / (H * 0.22), 0, 1)        # the underside sits in its own shade
    shade = np.clip(0.5 + 0.55 * diffuse - 0.3 * occl - 0.28 * under, 0, 1)
    light = np.array([255, 255, 255], float)
    mid = np.array([243, 240, 252], float)
    dark = np.array([212, 205, 236], float)
    s = shade[..., None]
    rgb = np.where(s > 0.6, mid + (light - mid) * (s - 0.6) / 0.4, dark + (mid - dark) * s / 0.6)
    im = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(im, 'RGBA')
    return img.crop(img.getbbox())


os.makedirs(OUT, exist_ok=True)
sheet = Image.new('RGBA', (W * 3, H), (170, 160, 215, 255))
for i, (seed, flat, spread) in enumerate([(3, 0.74, 0.3), (17, 0.7, 0.24), (41, 0.76, 0.33)]):
    c = cloud(seed, flat, spread)
    c.save(os.path.join(OUT, f'puff-{i + 1}.webp'), quality=88, method=6)
    sheet.alpha_composite(c, (i * W, 0))
    print(i + 1, c.size, os.path.getsize(os.path.join(OUT, f'puff-{i + 1}.webp')))
sheet.convert('RGB').resize((W * 3 // 2, H // 2)).save(os.path.join(OUT, 'puffs-preview.jpg'))
