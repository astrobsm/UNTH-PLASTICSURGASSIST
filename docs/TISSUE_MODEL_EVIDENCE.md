# Trained tissue models: what exists, and what we can use

Searched September 2026, for a trained model that could supply graft viability
or donor-site epithelialization — the two quantities `graftAnalysis` cannot
derive from area alone.

## What was found

| Candidate | Segments | Training data | Weights published | Licence | Verdict |
|---|---|---|---|---|---|
| [uwm-bigdata/wound-segmentation](https://github.com/uwm-bigdata/wound-segmentation) (Wang et al., *Sci Rep* 2020) | Wound **boundary** only | 1,109 AZH foot-ulcer images | Yes — one 26.1 MB `.hdf5` | **None** (no LICENSE file) | Unusable: no licence, and boundary segmentation is what we already do |
| [uwm-bigdata/DFUTissueSegNet](https://github.com/uwm-bigdata/DFUTissueSegNet) | Granulation, fibrin, callus, necrotic, eschar (+3) | **110 images** (78 train) | No | **None** | Unusable: no weights, no licence, dataset far too small |
| [Subhangini3/wound-segmentation-models](https://huggingface.co/Subhangini3/wound-segmentation-models) | Unstated | Unstated | Yes (`unet_best.keras`) | MIT | Unusable: 4 downloads, no model card, no dataset, no metrics, no provenance |
| [Shark26/ulcer-segmentation-using-pyramidnet-model](https://huggingface.co/Shark26/ulcer-segmentation-using-pyramidnet-model) | Unstated | Unstated | Yes (`.tflite`) | MIT | Same — 10 downloads, card carries only a licence line |
| [Hemg/Wound-Image-classification](https://huggingface.co/Hemg/Wound-Image-classification) | Whole-image **class**, not pixels | Unstated | Yes | Apache-2.0 | Wrong task: classifies an image, cannot give a proportion |
| [MONAI Model Zoo](https://github.com/Project-MONAI/model-zoo) | 36 bundles | — | Yes | Apache-2.0 | No wound, skin, dermatology or ulcer bundle exists |

**For graft viability and epithelialization specifically: nothing.** No public
dataset carries "viable graft" or "epithelialized donor site" pixel labels, so
no model has been trained on them.

## What the literature says the ceiling is

The best reported chronic-wound tissue segmentation
([Deep Learning for Wound Tissue Segmentation, arXiv 2502.10652](https://arxiv.org/pdf/2502.10652);
[Nature *Sci Rep* 2025](https://www.nature.com/articles/s41598-025-06703-5))
is DeepLabV3-R50 at mIoU 62.95%, Dice 76.82% — with **mean absolute error of
14.33 / 14.31 / 8.84 percentage points** on granulation / slough / eschar
*proportion*.

That error is the number that matters here. A graft-take figure carrying ±14
percentage points cannot distinguish 85% take from 99% take, which is the
distinction the clinician is actually making. And that is research performance,
on chronic wounds, not on grafts.

## What was therefore done

Nothing was bolted on. Dropping a 4-download Keras file into a clinical
measurement tool would put the appearance of a trained model on an artifact
with no provenance — worse than the honest refusal already in place, because a
number invites action and an absence invites looking.

Instead:

1. **`tissueModelProvider.ts`** implements the `ComputerVisionProvider`
   contract against TensorFlow.js, which is already a dependency. It is a
   complete, working inference adapter — preprocessing, inference, mask → class
   fractions → cm², confidence policy. It ships **inert**: with no model
   configured it never registers, and the null provider's refusal stands.
2. Registering a model is configuration, not code: set `VITE_TISSUE_MODEL_URL`
   and the accompanying declaration variables (see below).
3. A registered model must **declare its own validation status and measured
   error**. An undeclared model registers as unvalidated, and everything it
   produces is labelled `AI ESTIMATE — not clinically validated` per §14, with
   qualitative confidence only per §35.

## Registering a model

```
VITE_TISSUE_MODEL_URL=/models/tissue/model.json   # TF.js graph or layers model
VITE_TISSUE_MODEL_NAME=deeplabv3-r50-wound
VITE_TISSUE_MODEL_VERSION=1.0.0
VITE_TISSUE_MODEL_CLASSES=background,viable,nonviable   # output channel order
VITE_TISSUE_MODEL_INPUT=512                        # square input edge
VITE_TISSUE_MODEL_VALIDATED=false                  # only ever true with evidence
VITE_TISSUE_MODEL_MAE_PP=14.3                      # measured error, points
```

`VITE_TISSUE_MODEL_VALIDATED=true` is a clinical claim. It should be set only
where local validation against clinician ground truth exists, and the
validation should be recorded alongside this file.

## Re-check triggers

Worth searching again if any of these appear: a MONAI bundle for wound or skin
tissue; an AZH/DFUTissue release under a real licence; a public dataset with
graft-take or epithelialization labels; a tissue-proportion MAE reported below
about 5 percentage points.
