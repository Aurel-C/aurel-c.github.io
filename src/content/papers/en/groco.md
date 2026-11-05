---
title: "GroCo: Ground Constraint for Metric Self-Supervised Monocular Depth"
venue: ECCV
year: 2024
authors: A. Cecille, S. Duffner, F. Davoine, T. Neveu, R. Agier
tldr: Recovers metric-scale depth from a single camera without depth labels, using a ground-plane prior. Generalises better across datasets and camera placements.
thumb: groco
arxiv: https://arxiv.org/abs/2409.14850
code: https://github.com/Visual-Behavior/GroCo
order: 2
bibtex: |-
  @inproceedings{cecille2024groco,
    title     = {GroCo: Ground Constraint for Metric Self-Supervised Monocular Depth},
    author    = {C{\'e}cille, Aur{\'e}lien and Duffner, Stefan and Davoine, Franck and Neveu, Thibault and Agier, R{\'e}mi},
    booktitle = {European Conference on Computer Vision (ECCV)},
    year      = {2024}
  }
---

## Abstract

Monocular depth estimation has greatly improved in recent years, but models predicting metric depth still struggle to generalize across diverse camera poses and datasets. While recent supervised methods mitigate this issue by leveraging ground prior information at inference, their adaptability to self-supervised settings is limited due to the additional challenge of scale recovery. Addressing this gap, we propose a novel constraint on ground areas designed specifically for the self-supervised paradigm. This mechanism not only allows to accurately recover the scale but also ensures coherence between the depth prediction and the ground prior. Experimental results show that our method surpasses existing scale recovery techniques on the KITTI benchmark and significantly enhances model generalization capabilities. This improvement can be observed by its more robust performance across diverse camera rotations and its adaptability in zero-shot conditions with previously unseen driving datasets such as DDAD.

## Why scale is missing

A depth network trained from video learns by warping one frame into another. If you multiply all depths and the camera translation by the same factor $\lambda$, the warp is identical, so the training signal cannot tell a toy model from a real street. Self-supervised models are therefore correct only *up to scale*.

The ground fixes that. Once you know the camera's height $h$ and orientation, every pixel below the horizon has a known depth *if* it lies on a flat road:

$$
G(u, v) = \frac{h}{\mathbf{r}_2^\top K^{-1}\,[u, v, 1]^\top},
$$

with $\mathbf{r}_2^\top$ the row of the camera rotation that points down, towards the ground. The hard part is that you do not know which pixels are road. Cars, curbs and walls break the prior, and nothing in self-supervision says where they are.

## Method

The analytic ground depth $G$ is fed to the network as a fourth input channel next to RGB, so the model sees where the camera is pointing. The network predicts a depth map $\hat Z$ and an attention map $\alpha \in [0,1]$, and the final depth blends the two:

$$
Z_i = (1-\alpha_i)\,\hat Z_i + \alpha_i\,G_i .
$$

On its own this collapses: the easiest solution is $\alpha = 0$ everywhere. The key is the **ground constraint loss**, which ties scale recovery and ground selection together:

$$
\mathcal{L}_{\text{const}} = \frac{1}{N}\sum_i \alpha_i^2\,\big|\hat Z_i - G_i\big| .
$$

Where attention is high, the network's own depth must agree with the metric prior, which pulls its whole scale to metres. Where the prior is wrong (a car, a wall) the error is large, so turning attention on would be costly, and the attention learns to stay off. The same term teaches the scale *and* where the road is.

A lower-bound regulariser prevents the trivial all-zero attention without forcing it anywhere in particular:

$$
\mathcal{L}_{\text{reg}} = \frac{\max\!\big(0,\ \tau - \tfrac{1}{N}\sum_i \alpha_i^2\big)}{\tau^2},
$$

where $\tau$ is the fraction of the image expected to be road, which can be set from the road width and camera height. Results stay stable over a wide range of $\tau$.

<figure>
  <img src="/figures/papers/groco_seg.webp" alt="Ground attention overlaid on two KITTI images" loading="lazy">
  <figcaption>Ground attention learned without any segmentation labels. Even with close obstacles, it stays on the road.</figcaption>
</figure>

## Results

On KITTI, among methods that use only the camera height to recover scale (no scaling at test time):

| KITTI, original labels | AbsRel ↓ | SqRel ↓ | RMSE ↓ | δ<1.25 ↑ |
|---|---|---|---|---|
| Scale Recovery | 0.123 | 0.996 | 5.253 | 0.840 |
| VADepth | 0.120 | 0.975 | 4.971 | 0.867 |
| **GroCo** | **0.113** | **0.851** | **4.756** | **0.870** |

The real gain is robustness. A baseline with the same training and rotation augmentation is as good on standard KITTI images, but breaks down when the camera is tilted, because it learned the dataset's usual viewpoint rather than the geometry:

| AbsRel ↓ at test time | None | 5° roll | −5° pitch | 15° yaw |
|---|---|---|---|---|
| Baseline | 0.092 | 0.140 | 0.145 | 0.209 |
| **GroCo** | **0.089** | **0.101** | **0.086** | **0.136** |

<figure>
  <img src="/figures/papers/groco_rot.webp" alt="Depth predictions under roll, yaw and pitch rotations" loading="lazy">
  <figcaption>Depth under camera rotations, and the difference with the baseline. Red means the baseline is worse.</figcaption>
</figure>

Trained on KITTI and tested zero-shot on the front camera of DDAD, a different car, camera and city, AbsRel drops from 0.403 to 0.154, and δ<1.25 rises from 0.06 to 0.76. Trained on the DDAD front camera and tested on its other cameras, GroCo also beats supervised camera-aware methods.

