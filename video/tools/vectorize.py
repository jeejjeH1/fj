"""Trace the two logo PNGs into polygon layers for 3D extrusion (writes src/logos.json)."""
import json, cv2, numpy as np

def polys(mask, eps):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None: return out
    hier = hier[0]
    for i, c in enumerate(cs):
        if hier[i][3] != -1 or cv2.contourArea(c) < 60: continue
        outer = cv2.approxPolyDP(c, eps, True)[:, 0].tolist()
        holes, j = [], hier[i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) > 60:
                holes.append(cv2.approxPolyDP(cs[j], eps, True)[:, 0].tolist())
            j = hier[j][0]
        out.append({"outer": outer, "holes": holes})
    return out

def norm(layers, size):
    for L in layers:
        for p in L["polys"]:
            f = lambda pts: [[round((x / size - .5) * 2, 4), round(-(y / size - .5) * 2, 4)] for x, y in pts]
            p["outer"] = f(p["outer"]); p["holes"] = [f(h) for h in p["holes"]]
    return layers

S = 1024
# --- MetaMask fox: colour regions -> layered facets
im = cv2.resize(cv2.imread("assets/metamask.png"), (S, S), interpolation=cv2.INTER_CUBIC)
pal = {  # rgb, z-offset (relief)
    "bg": ((0, 0, 0), None),
    "light": ((254, 140, 92), 0.10),
    "dark": ((101, 23, 0), 0.00),
    "orange": ((226, 71, 6), 0.05),
    "bright": ((254, 91, 21), 0.08),
    "white": ((205, 208, 222), 0.12),
    "gray": ((194, 196, 205), 0.09),
    "nose": ((60, 40, 35), 0.14),
}
names = list(pal)
cols = np.array([pal[n][0][::-1] for n in names], np.float32)
d = ((im.reshape(-1, 1, 3).astype(np.float32) - cols[None]) ** 2).sum(-1)
lab = d.argmin(1).reshape(S, S)
k = np.ones((5, 5), np.uint8)
fox = []
silhouette = (lab != 0).astype(np.uint8) * 255
silhouette = cv2.morphologyEx(silhouette, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
fox.append({"name": "base", "color": "#3a1204", "z": -0.02, "polys": polys(silhouette, 4)})
for i, n in enumerate(names[1:], 1):
    m = (lab == i).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    r, g, b = pal[n][0]
    fox.append({"name": n, "color": "#%02x%02x%02x" % (r, g, b), "z": pal[n][1], "polys": polys(m, 5.0)})
dbg = np.zeros_like(im)
for i in range(len(names)): dbg[lab == i] = cols[i]
cv2.imwrite("out/fox_debug.png", dbg)

# --- GenLayer mark: dark pixels on transparent
g = cv2.imread("assets/genlayer.png", cv2.IMREAD_UNCHANGED)
g = cv2.resize(g, (S, S), interpolation=cv2.INTER_CUBIC)
m = ((g[..., 3] > 128) & (g[..., :3].mean(-1) < 128)).astype(np.uint8) * 255
gl = [{"name": "mark", "color": "#ffffff", "z": 0, "polys": polys(m, 2.0)}]
cv2.imwrite("out/gl_debug.png", m)

json.dump({"fox": norm(fox, S), "genlayer": norm(gl, S)}, open("src/logos.json", "w"))
for L in fox + gl: print(L["name"], len(L["polys"]), sum(len(p["outer"]) for p in L["polys"]))
