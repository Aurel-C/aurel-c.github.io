---
title: Towards Sharper Object Boundaries in Self-Supervised Depth Estimation
venue: BMVC
year: 2025
award: Oral
authors: A. Cecille, S. Duffner, F. Davoine, R. Agier, T. Neveu
tldr: Models per-pixel depth as a mixture distribution, removing blurred edges and spurious 3D points. Up to 35% sharper boundaries on KITTI and VKITTI2.
thumb: sob
arxiv: https://arxiv.org/abs/2509.15987
code: https://github.com/Visual-Behavior/SOB
order: 1
bibtex: |-
  @inproceedings{cecille2025sharper,
    title     = {Towards Sharper Object Boundaries in Self-Supervised Depth Estimation},
    author    = {C{\'e}cille, Aur{\'e}lien and Duffner, Stefan and Davoine, Franck and Agier, R{\'e}mi and Neveu, Thibault},
    booktitle = {British Machine Vision Conference (BMVC)},
    year      = {2025}
  }
---

## Abstract

Accurate monocular depth estimation is crucial for 3D scene understanding, but existing methods often blur depth at object boundaries, introducing spurious intermediate 3D points. While achieving sharp edges usually requires very fine-grained supervision, our method produces crisp depth discontinuities using only self-supervision. Specifically, we model per-pixel depth as a mixture distribution, capturing multiple plausible depths and shifting uncertainty from direct regression to the mixture weights. This formulation integrates seamlessly into existing pipelines via variance-aware loss functions and uncertainty propagation. Extensive evaluations on KITTI and VKITTIv2 show that our method achieves up to 35% higher boundary sharpness and improves point cloud quality compared to state-of-the-art baselines.

<figure>
  <img src="/figures/papers/sob_pcd_comp.webp" alt="Point clouds from HR-Depth and from our model on a KITTI street" loading="lazy">
  <figcaption>Point clouds reconstructed from the predicted depth. The baseline (left) leaves trails of floating points between pedestrians and the background; ours (right) cuts cleanly.</figcaption>
</figure>

## The problem: depth "in between"

Think of a tree in front of a house. At the edge of the trunk, a pixel sees a bit of both, and a network trained with a regression loss hedges: it predicts a depth halfway between the tree and the house. That value matches neither surface. In the depth map it looks like a soft edge; in 3D it becomes a curtain of points floating in empty space, which is exactly what a planner or an occupancy map should never see.

Self-supervised training makes this worse. The photometric loss is computed through bilinear sampling and an edge-aware smoothness term, and both reward smooth transitions.

## The idea: two depths per pixel

Instead of one value, each pixel predicts a **two-component Gaussian mixture** over disparity (inverse depth):

$$
\mathcal{M}(z^{-1}) = w_1\,\mathcal{N}(z^{-1}\mid\mu_1,\sigma_1^2) + w_2\,\mathcal{N}(z^{-1}\mid\mu_2,\sigma_2^2), \qquad w_1 + w_2 = 1 .
$$

The network outputs five channels: $\mu_1, \mu_2, \sigma_1^2, \sigma_2^2, w_1$. At a boundary, one component can hold the foreground and the other the background, so the uncertainty moves out of the depth value and into the weight. At inference we pick the most likely component instead of averaging:

$$
d^* = \begin{cases} \mu_1 & \text{if } w_1 > 0.5 \\ \mu_2 & \text{otherwise.} \end{cases}
$$

Since each mean stays nearly constant on its side of the edge and only the weight changes, the selection creates a clean step. This also means the parameters can be upsampled to any resolution without blurring the edge.

<figure>
  <img src="/figures/papers/sob_grid.webp" alt="Input image, predicted depth, mixture weight and difference between the two means" loading="lazy">
  <figcaption>(1) Input, (2) predicted depth, (3) mixture weight (blue = 0, white = 0.5, red = 1), (4) relative difference between the two means. Both modes appear exactly where objects meet the background.</figcaption>
</figure>

## Making self-supervision work with distributions

The training signal still comes from reprojecting a neighbouring frame into the current view (see the [explainer on self-supervision](/learn/multi-view/)). The difference is that every quantity is now a distribution. We propagate each component with a first-order approximation, as in an extended Kalman filter:

$$
f(Z_k^{-1}) \sim \mathcal{N}\big(f(\mu_k),\, f'(\mu_k)^2\sigma_k^2\big).
$$

Reprojection and bilinear sampling are fused into one function from disparity to colour, so its derivative is just the image gradient at the sampled point times the derivative of the reprojection. Each component therefore yields a mean and a variance of the photometric error $E_k$.

The components then compete. The target weight of component $k$ is the probability that it explains the image better than the other one, which has a closed form because the difference of two Gaussians is Gaussian:

$$
\bar w_k = P(E_k < E_{1-k}) = \Phi\!\left(\frac{\mu_{E_{1-k}} - \mu_{E_k}}{\sqrt{\sigma_{E_{1-k}}^2 + \sigma_{E_k}^2}}\right).
$$

The loss has three parts: the usual photometric error on the selected component, a term that aligns the predicted variance with the observed error, and a cross-entropy that pulls the weights towards $\bar w_k$.

## Results

All methods below use the same ConvNeXt-Base backbone and data pipeline. Global metrics move only a little, which is expected since edges are a small fraction of pixels. Point-cloud metrics improve, and boundary sharpness improves a lot.

| Edge sharpness ↓ (KITTI) | M | MS | S |
|---|---|---|---|
| Monodepth2 | 0.499 | 0.520 | 0.509 |
| **Ours (MD2 decoder)** | **0.350** | **0.336** | **0.387** |
| HR-Depth | 0.471 | 0.456 | 0.516 |
| **Ours (HR-Depth decoder)** | **0.373** | **0.357** | **0.385** |

The sharpness score is the mean Bernoulli entropy of normalised depth around Canny edges: 0 is a perfect step, 1 a linear ramp. M, S and MS stand for training on monocular video, stereo pairs, or both.

| KITTI, monocular | AbsRel ↓ | Chamfer ↓ | F-score ↑ | IoU ↑ |
|---|---|---|---|---|
| Monodepth2 | 8.82 | 0.71 | 46.64 | 31.62 |
| HR-Depth | 8.65 | 0.69 | 47.35 | 32.10 |
| **Ours (HR-Depth decoder)** | **8.50** | **0.66** | **48.46** | **33.11** |

<figure>
  <img src="/figures/papers/sob_zoom.webp" alt="Close-ups of depth maps from HR-Depth and from our model" loading="lazy">
  <figcaption>Close-ups: HR-Depth on the left of each pair, ours in red. Sign posts, poles and car outlines keep their shape.</figcaption>
</figure>

## Uncertainty for free

The mixture also gives a calibrated uncertainty. By the law of total variance it splits into the spread of each component and the disagreement between them, which lights up exactly on occlusion boundaries.

<figure>
  <img src="/figures/papers/sob_uncertainty.webp" alt="Depth along one image row with uncertainty band, and uncertainty maps" loading="lazy">
  <figcaption>Left: depth along one image row with its predicted distribution and LiDAR points. Right: the two parts of the predicted variance.</figcaption>
</figure>

