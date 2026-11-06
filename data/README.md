# Data request for the SPAN companion web page

Read this whole file first. You are working on an HPC login node that holds the SPAN simulation outputs (VASP, MACE, the lithiation pipeline and the evolutionary loop). Your job is to locate the source data, write three JSON files into the `data/` folder of the web-site repository, check them, and push. Nothing else on the site changes.

The site: https://soniyuvraj16.github.io/span-poster/ (repository https://github.com/soniyuvraj16/span-poster). Its interactive blocks are already coded in `interactive.js` and stay hidden until these files exist:

| File | Section of the page | What it drives |
|---|---|---|
| `data/discharge_box.json` | 4, "Watch one box discharge" | 3D trajectory of one box from pristine to Li/S = 2, synchronized with its voltage curve, bond counters computed live from the coordinates |
| `data/evolution.json` | 5, "Generations closing in on the experiment" | population scatter per generation, best box vs experiment, score vs generation |
| `data/pocket_cycle.json` | 6, "Lithium held in a nitrogen pocket" | 3D view of one pocket through discharge and charge, Li–N distances, the trapped capacity shaded on the curve |

## Rules

1. **Real data only.** Every number must come from a simulation output or the experimental curve already used for the poster. If a piece is missing, leave the file out and say so in your report; the block simply stays hidden. Never synthesize or smooth values to fill gaps.
2. **No cluster names anywhere**, not in labels, not in commit messages. If a label needs a computing credit, write "Texas A&M HPRC".
3. **Size.** Each file under 6 MB. Round coordinates to 3 decimals, capacities to 1 decimal, voltages to 3 decimals. Subsample frames rather than exceed the budget.
4. **Units.** Coordinates in Å, wrapped into the cell. Capacity in mAh per gram of lithium-free SPAN. Voltage in V vs Li/Li⁺. Cell as `[a, b, c]` for orthorhombic boxes or a 3×3 matrix (rows are lattice vectors) otherwise.
5. **Atom order must be stable across frames** inside one file: framework atoms (C, N, S, H) first in a fixed order, lithium after them. New lithium is appended at the end. When lithium is removed on charge, delete it from the list; the framework indices never change.
6. **Element symbols** as strings: `"C"`, `"N"`, `"S"`, `"H"`, `"Li"`. Other elements (O, F) are rendered but not counted.
7. Validate with the checker at the bottom of this file before committing.

## Where the sources probably are

Start from the poster build directory (the default path in `make_qr.py` is `/scratch/user/soniyuvraj/MACE_SPAN/62-aiche_poster/`); its figure scripts read the exact files used for `fig_discharge_exp.png`, `fig_trapping2.png`, `fig_gen1_scores.png` and `fig_voltage_mix.png`, so grep them for input paths. Expect:

- Lithiation runs: one directory per box and per insertion order, with an ASE trajectory (`.traj` or `.extxyz`) of the relaxed configuration after each lithium batch, plus a table of step energies, voltages and capacities (the step voltage V_step = −[E(Li_n) − E(Li_{n−k}) − k E_Li] / k, capacity Q = n F / M_SPAN).
- The composition-matched boxes of panel 4: the 400 °C and 450 °C boxes, 30 insertion orders each, with the mean curve and 1 s.d. band.
- The C=S box used for panel 6 (first discharge, then charge removing the cheapest lithium first, 3.0 V cutoff, 74 mAh/g trapped, 18 %), with the pocket (two to four ring nitrogens) that the DFT check used (2.38 eV DFT, 2.67 eV HSE06, 2.12 eV MACE).
- The evolutionary loop: Generation 1 results (39 mixtures, 78 packings submitted, 36 scored, top third kept), per box: motif composition, S:N, H:N, capacity at Li/S = 2, mean voltage, score components, and the best box's curve. Later generations if they exist.
- The experimental curves: reversible-cycle curves reconstructed by integrating measured dQ/dV for the 400 °C and 450 °C samples, mean voltage 1.79 V, capacity at the 1.0 V cutoff about 525 mAh/g.

If a file is not where you expect, search by content: `grep -rl "insertion" --include=*.py`, `find . -name "*.traj" -newer make_qr.py`, `grep -rl "dQ/dV" --include=*.py --include=*.csv`.

## File 1: `data/discharge_box.json`

Pick the 400 °C composition-matched box (the one in the left plot of `fig_discharge_exp.png`) and one representative insertion order, preferably the order whose curve is closest to the 30-order mean. Frames are the relaxed configurations after each batch (18 to 24 frames). You may add intermediate MD frames between batches, up to about 60 frames in total.

```json
{
  "label": "400 °C composition-matched box, S:N 1.30, H:N 0.55, insertion order 07 of 30",
  "cell": [14.1, 16.2, 16.0],
  "frames": [
    {"capacity_mAh_g": 0.0,   "voltage_V": null,  "symbols": ["C","C","N", "...", "S"], "xyz": [[0.123, 4.567, 8.901], "..."]},
    {"capacity_mAh_g": 27.4,  "voltage_V": 3.052, "symbols": ["C","C","N", "...", "S", "Li", "Li", "Li"], "xyz": ["..."]},
    {"capacity_mAh_g": 54.8,  "voltage_V": 2.871, "symbols": ["..."], "xyz": ["..."]}
  ],
  "curve": {
    "capacity_mAh_g": [27.4, 54.8, "..."],
    "voltage_V":      [2.98, 2.80, "..."],
    "band_V":         [0.21, 0.19, "..."]
  },
  "experiment": {
    "capacity_mAh_g": [0, 5, 10, "..."],
    "voltage_V":      [2.31, 2.28, "..."]
  }
}
```

- `frames[i].voltage_V` is the step voltage of the batch that produced frame i (null for the pristine frame). `capacity_mAh_g` is cumulative.
- `curve` is optional: the mean over the 30 insertion orders with its 1 s.d. band, on the same capacity grid or any grid. If omitted, the page plots the single order's step voltages.
- `experiment` is optional but wanted: the reconstructed reversible curve for the matching sample, in absolute mAh/g (not the normalized fraction used on the poster).

## File 2: `data/evolution.json`

One entry per generation. Generation 1 alone is fine; the viewer handles any number.

```json
{
  "score_definition": "composition distance (S:N, H:N, 0.15 tolerance) + RMS curve distance over the common capacity range (0.2 V units) + half the mean-voltage distance (0.2 V units)",
  "experiment": {
    "mean_voltage_V": 1.79,
    "capacity_mAh_g": 525,
    "S_N": 1.30, "H_N": 0.55,
    "curve": {"capacity_mAh_g": [0, 5, "..."], "voltage_V": [2.31, "..."]}
  },
  "generations": [
    {
      "generation": 1,
      "best_id": "g1-17",
      "boxes": [
        {"id": "g1-17", "motifs": {"C=S every C": 1, "pendant C-S6-H": 2, "N-S4-N": 1},
         "S_N": 1.27, "H_N": 0.58, "capacity_mAh_g": 541, "mean_voltage_V": 1.85,
         "score": 0.92, "score_terms": {"composition": 0.2, "curve": 0.5, "mean_voltage": 0.22},
         "kept": true, "n_orders": 4,
         "curve": {"capacity_mAh_g": [0, 25, "..."], "voltage_V": [2.9, "..."], "band_V": [0.1, "..."]}},
        {"id": "g1-02", "motifs": {"C-S4-C": 2, "intra S3": 2}, "S_N": 1.41, "H_N": 0.44,
         "capacity_mAh_g": 612, "mean_voltage_V": 1.63, "score": 2.41, "kept": false, "n_orders": 3}
      ]
    }
  ]
}
```

- `motifs` maps motif name to the number of chain pairs (out of 4) carrying it; use the same ten motif names the poster's final version uses.
- `capacity_mAh_g` is the capacity at Li/S = 2; `mean_voltage_V` the mean discharge voltage to Li/S = 2.
- `curve` is needed only for the best box of each generation (include it for every kept box if the file stays small).
- `kept` marks the top third that seeds the next generation.

## File 3: `data/pocket_cycle.json`

The C=S box of panel 6, first discharge then charge. Frames are the relaxed configurations after each batch on discharge and after each removal on charge; mark the branch. `pocket.n_atoms` are the indices of the ring nitrogens of one trapping pocket. Choose it from the charge branch: find the lithium removed at the highest voltage above the cutoff (match lithium between consecutive charge frames by position, since removed atoms are deleted from the list), take its nitrogen neighbours within 2.6 Å, and check that this nitrogen set is occupied by some lithium (at least two N within 2.45 Å) from early discharge until the charge branch passes the cutoff. The page tracks the pocket, not an atom index: in every frame it highlights whichever lithium sits in it, because lithium atoms exchange during the anneals. `pocket.li_atom` is optional (the index of the first lithium, for reference). If you must subsample, keep every frame between 0 and 120 mAh/g on both branches.

```json
{
  "label": "C=S box, S:N 1.25, H:N 0.60, first cycle, 3.0 V charge cutoff",
  "cell": [14.0, 16.0, 16.1],
  "pocket": {"n_atoms": [41, 58, 73, 90], "li_atom": 248},
  "trapped_mAh_g": 74.0,
  "trapped_fraction": 0.18,
  "charge_cutoff_V": 3.0,
  "frames": [
    {"branch": "discharge", "capacity_mAh_g": 0.0,  "voltage_V": null,  "symbols": ["..."], "xyz": ["..."]},
    {"branch": "discharge", "capacity_mAh_g": 24.6, "voltage_V": 3.15,  "symbols": ["..."], "xyz": ["..."]},
    {"branch": "charge",    "capacity_mAh_g": 380.2,"voltage_V": 1.05,  "symbols": ["..."], "xyz": ["..."]},
    {"branch": "charge",    "capacity_mAh_g": 74.0, "voltage_V": 3.0,   "symbols": ["..."], "xyz": ["..."]}
  ]
}
```

- On the charge branch `capacity_mAh_g` is the lithium still in the box (so it decreases), and `voltage_V` is the removal voltage of that step. If the poster's charge curve is drawn as a running maximum, give the raw step voltages here; the page plots what it gets.
- `trapped_mAh_g` and `trapped_fraction` shade the region of the curve that does not come out below the cutoff.

## Building the files with ASE (sketch)

```python
import json, numpy as np
from ase.io import read

def frame_from_atoms(atoms, capacity, voltage, branch=None):
    atoms = atoms.copy(); atoms.wrap()
    d = {"capacity_mAh_g": round(float(capacity), 1),
         "voltage_V": None if voltage is None else round(float(voltage), 3),
         "symbols": atoms.get_chemical_symbols(),
         "xyz": np.round(atoms.get_positions(), 3).tolist()}
    if branch: d = {"branch": branch, **d}
    return d

traj = read("order_07/lithiation.traj", index=":")        # one Atoms per relaxed batch
steps = np.loadtxt("order_07/steps.csv", delimiter=",", skiprows=1)  # columns: n_Li, capacity, voltage
cell = np.round(np.diag(traj[0].cell), 3).tolist()         # use traj[0].cell[:].tolist() if not orthorhombic
frames = [frame_from_atoms(traj[0], 0.0, None)] + [
    frame_from_atoms(a, c, v) for a, (n, c, v) in zip(traj[1:], steps)]
json.dump({"label": "...", "cell": cell, "frames": frames, "curve": {...}, "experiment": {...}},
          open("data/discharge_box.json", "w"), separators=(",", ":"))
```

Keep the atom order of the trajectory; if the pipeline reorders atoms between batches, sort each frame back to the pristine order before writing (match by index map, never by distance).

## Checker

Run this from the repository root before committing. It checks the structure, the atom-order rule, sizes and cutoff sanity, and prints what the page will show.

```python
import json, os, sys
ok = True
def need(c, msg):
    global ok
    if not c: ok = False; print("FAIL:", msg)

for name in ["discharge_box", "pocket_cycle"]:
    path = f"data/{name}.json"
    if not os.path.exists(path): print("skip", path); continue
    d = json.load(open(path)); need(os.path.getsize(path) < 6e6, f"{path} over 6 MB")
    fr = d["frames"]; need(len(fr) >= 5, f"{path}: fewer than 5 frames")
    fw0 = [s for s in fr[0]["symbols"] if s != "Li"]
    for i, f in enumerate(fr):
        need(len(f["symbols"]) == len(f["xyz"]), f"{path} frame {i}: symbols/xyz length differ")
        fw = [s for s in f["symbols"] if s != "Li"]
        need(fw == fw0, f"{path} frame {i}: framework atom order changed")
        need(all(s == "Li" for s in f["symbols"][len(fw0):]), f"{path} frame {i}: lithium not at the end")
    if name == "pocket_cycle":
        p = d["pocket"]; need(all(fr[0]["symbols"][j] == "N" for j in p["n_atoms"]), "pocket n_atoms are not nitrogen")
        need(len([f for f in fr if f.get("branch") == "charge"]) > 0, "no charge frames")
    print(path, len(fr), "frames,", len(fr[-1]["symbols"]), "atoms in the last frame")

path = "data/evolution.json"
if os.path.exists(path):
    d = json.load(open(path))
    for g in d["generations"]:
        need(any(b["id"] == g.get("best_id") for b in g["boxes"]), f"generation {g['generation']}: best_id not in boxes")
        need(any(b.get("curve") for b in g["boxes"]), f"generation {g['generation']}: no box has a curve")
        print(path, "generation", g["generation"], len(g["boxes"]), "boxes,", sum(b["kept"] for b in g["boxes"]), "kept")
    need("curve" in d["experiment"], "experiment.curve missing")
print("OK" if ok else "FIX THE FAILURES ABOVE"); sys.exit(0 if ok else 1)
```

## Test locally, then publish

```bash
git clone https://github.com/soniyuvraj16/span-poster.git && cd span-poster
# write the three files into data/
python -m http.server 8000     # fetch() needs http, not file://
# open http://localhost:8000/ and check sections 4, 5 and 6 show the new blocks with no console errors
git add data && git commit -m "Add trajectory and loop data for the interactive views" && git push
```

GitHub Pages redeploys within a minute. Report back: which of the three files you wrote, the source path of each, frame counts and file sizes, and anything you could not find.
