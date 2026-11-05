---
title: Learning depth from video
summary: Stereo, epipolar geometry and structure from motion, then how self-supervised networks turn them into a training signal by warping one frame into another.
chapter: 3
order: 2
---

Dense depth labels are expensive: they need LiDAR or structured-light sensors, careful calibration and a lot of post-processing. Self-supervised methods avoid them entirely. The idea is that a video from a moving camera already contains the geometry: **if you know the depth of a frame and how the camera moved, you can predict what the next frame looks like.** Compare that prediction with the real frame, and the error becomes the training signal.

This page first recalls the classical geometry behind that idea, then shows how it becomes a differentiable loss.

## Two views of the same scene

### Stereo and disparity

Look at a tree from two slightly different positions. It shifts between the two views, and the closer it is, the more it shifts. That shift is the **disparity**.

<figure class="diagram">
  <img src="/figures/learn/disparity.svg" alt="The same tree seen from two camera positions" loading="lazy">
  <figcaption>Disparity: the horizontal shift of the same point between two rectified views, inversely proportional to depth.</figcaption>
</figure>

For a rectified stereo pair (two cameras side by side, perfectly aligned) with baseline $B$ and focal length $f$, disparity $d$ and depth are linked by

$$
Z = \frac{f B}{d}.
$$

Because of the $1/d$, a one-pixel error barely matters up close and becomes metres far away.

### Epipolar geometry

Before triangulating, you must find which pixel in one image matches which pixel in the other. Geometry narrows the search. The two camera centres $C_1$, $C_2$ and the 3D point $P$ define a plane, which cuts each image along an **epipolar line**. The match of $p_1$ must lie on the line $l_2$: a 2D search becomes 1D.

<figure class="diagram">
  <img src="/figures/learn/epipolar_geometry.svg" alt="Epipolar plane, epipolar lines and epipoles between two cameras" loading="lazy">
  <figcaption>Epipolar geometry. Given a point in the first image, its match lies on a line in the second.</figcaption>
</figure>

Algebraically, with normalised coordinates $\tilde x = K^{-1}\tilde p$, every correct match satisfies

$$
\tilde x_2^\top E\, \tilde x_1 = 0, \qquad E = [\mathbf t]_\times R,
$$

where $E$ is the **essential matrix** and $(R, \mathbf t)$ the relative pose. The equation is unchanged if $\mathbf t$ is multiplied by any factor, so $E$ has 5 degrees of freedom, not 6: **translation, and therefore the scene's scale, can only be recovered up to an unknown factor.** This is the same scale ambiguity seen in [monocular depth](/learn/mono-depth/), now coming from geometry.

### Structure from motion

Structure from motion (SfM) applies the same geometry to successive frames of one moving camera. The baseline is no longer fixed; it is the camera's own motion, which must be estimated too. A classical pipeline:

1. detect and match keypoints between frames (SIFT, ORB, or learned matchers like SuperPoint and LoFTR);
2. estimate the relative pose robustly with RANSAC, since many matches are wrong;
3. triangulate 3D points, register new frames with Perspective-n-Point;
4. refine everything with **bundle adjustment**, which minimises the reprojection error of all points in all views.

<figure>
  <img src="/figures/learn/matches.webp" alt="Keypoint matches between two consecutive frames" loading="lazy">
  <figcaption>Correspondences between two frames, found with LoFTR.</figcaption>
</figure>

SfM is accurate but sparse, slow, and fragile with low parallax, textureless areas and moving objects. Self-supervised depth learning keeps its principle and replaces matching and bundle adjustment with two neural networks and a dense photometric loss.

## Learning depth and pose

<figure class="diagram">
  <img src="/figures/learn/ssl_pipeline.svg" alt="Self-supervised pipeline with depth network, pose network, warping and photometric loss" loading="lazy">
  <figcaption>The self-supervised pipeline. A depth network and a pose network predict geometry, which is used to warp the support frame into the reference view. The photometric error between the two trains both networks.</figcaption>
</figure>

A **depth network** predicts the depth of the reference frame $I_{\text{ref}}$. A **pose network** predicts the camera motion $(R, \mathbf t)$ to a neighbouring support frame $I_{\text{sup}}$. With these, the support frame is warped into the reference viewpoint and compared to the real thing. It behaves like an autoencoder whose bottleneck is geometry.

### The reprojection equation

<figure class="diagram">
  <img src="/figures/learn/reprojection_pipeline.svg" alt="Unproject with depth, transform with pose, project into the support frame" loading="lazy">
  <figcaption>Reprojection: lift a pixel to 3D with its depth, move it with the relative pose, project it into the support frame.</figcaption>
</figure>

Three steps take a reference pixel $\tilde{\mathbf p} = (u, v, 1)$ to the support image:

$$
\mathbf P_{\text{ref}} = Z(\mathbf p)\,K^{-1}\tilde{\mathbf p}, \qquad
\mathbf P_{\text{sup}} = R\,\mathbf P_{\text{ref}} + \mathbf t, \qquad
\mathbf p_{\text{sup}} = \pi(K\,\mathbf P_{\text{sup}}),
$$

where $\pi$ divides by depth. In one line:

$$
\mathbf p_{\text{sup}} = \pi\!\left( K \left[ R\, Z(\mathbf p)\, K^{-1} \tilde{\mathbf p} + \mathbf t \right] \right).
$$

### Reprojection is rigid optical flow

The displacement $\mathbf f = \mathbf p_{\text{sup}} - \mathbf p$ is an optical flow, but a constrained one: it is fully determined by depth and camera motion, assuming the scene is static. For a pure translation its magnitude is roughly

$$
\lVert \mathbf f \rVert \propto \frac{\lVert \mathbf t \rVert}{Z}.
$$

Close things move more than distant ones: this **motion parallax** is what lets the networks separate depth from motion. Rotation adds a flow that does not depend on depth at all, so depth is learned from the translational part.

<figure class="pair">
  <img src="/figures/learn/flow_stereo_color.webp" alt="Rigid flow magnitude for a lateral translation" loading="lazy">
  <img src="/figures/learn/flow_stereo_arrows.webp" alt="Rigid flow vectors for a lateral translation" loading="lazy">
  <figcaption>Rigid flow for a sideways translation (a stereo pair): near objects move most.</figcaption>
</figure>

<figure class="pair">
  <img src="/figures/learn/flow_forward_color.webp" alt="Rigid flow coloured by direction for forward motion" loading="lazy">
  <img src="/figures/learn/flow_forward_arrows.webp" alt="Rigid flow vectors for forward motion" loading="lazy">
  <figcaption>Rigid flow for forward motion, typical of a car. Hue is direction, saturation is magnitude; the flow expands from the centre.</figcaption>
</figure>

### Inverse warping

To build the synthetic reference image, it is tempting to push each reference pixel to where it lands in the support frame. This **forward warping** leaves holes where nothing lands and collisions where several pixels land on the same spot. **Inverse warping** goes the other way: for every pixel of the reference grid, compute where it falls in the support frame and *fetch* the colour there. Every output pixel gets exactly one value.

<figure class="pair">
  <img src="/figures/learn/forward_warp.webp" alt="Forward warping result with holes" loading="lazy">
  <img src="/figures/learn/inverse_warp.webp" alt="Inverse warping result" loading="lazy">
  <figcaption>Forward warping (left) leaves holes and collisions. Inverse warping (right) fills every pixel, though occluded regions can appear duplicated.</figcaption>
</figure>

$$
\hat I_{\text{ref}}(\mathbf p) = I_{\text{sup}}\big(\text{reproject}(\mathbf p, Z(\mathbf p), R, \mathbf t)\big).
$$

If depth is overestimated the displacement is too small; if underestimated, too large. Either way the warped image is misaligned, and the error tells the network which way to go.

### Differentiable sampling

Reprojected coordinates are not integers: a pixel may land at $(15.7, 23.3)$. Its colour is obtained by **bilinear interpolation** of the four surrounding pixels, with fractional offsets $\alpha, \beta$:

$$
I(u', v') = \begin{bmatrix} 1-\alpha & \alpha \end{bmatrix}
\begin{bmatrix} I_{00} & I_{01} \\ I_{10} & I_{11} \end{bmatrix}
\begin{bmatrix} 1-\beta \\ \beta \end{bmatrix}.
$$

<figure class="diagram">
  <img src="/figures/learn/bilinear_interpolation.svg" alt="Bilinear interpolation between four pixels" loading="lazy">
  <figcaption>Bilinear interpolation: each neighbour's weight is the area of the opposite rectangle.</figcaption>
</figure>

This is differentiable with respect to $(u', v')$, which closes the loop: a small change of depth moves the sampling point, which changes the colour, which changes the loss. Gradients flow from the image error back to depth and pose. In PyTorch this whole step is a single `grid_sample`.

## The loss

### Photometric error: SSIM + L1

An L2 loss on colours is dominated by outliers (occlusions, moving cars, reflections). L1 is more robust, and SSIM compares local structure (mean, contrast, correlation) rather than raw intensities, which makes it tolerant to lighting changes. The standard mix is

$$
\mathcal L_{\text{photo}} = \alpha\,\frac{1 - \text{SSIM}(I_{\text{ref}}, \hat I_{\text{ref}})}{2} + (1-\alpha)\,\lvert I_{\text{ref}} - \hat I_{\text{ref}} \rvert, \qquad \alpha = 0.85.
$$

### Edge-aware smoothness

On textureless areas the photometric loss says little, so a regulariser favours smooth depth, except where the image itself has edges:

$$
\mathcal L_{\text{smooth}} = \lvert \partial_x \bar D \rvert\, e^{-\lvert \partial_x I \rvert} + \lvert \partial_y \bar D \rvert\, e^{-\lvert \partial_y I \rvert}, \qquad \bar D = D / \text{mean}(D).
$$

Dividing by the mean keeps the network from cheating by shrinking all depths. This term helps image metrics but tends to blur object boundaries in 3D, one of the motivations for the [sharper boundaries paper](/papers/sob/).

### Minimum reprojection and auto-masking

Monodepth2 added two simple tricks that are now standard. First, use the frames before *and* after the reference, and keep the **per-pixel minimum** of the two errors. A point hidden in the previous frame is usually visible in the next one, so occlusions are mostly handled for free.

Second, some pixels do not move at all: the sky, or a car driving at the same speed as the camera. For them, predicting infinite depth gives a near-zero error, which teaches the network nonsense. **Auto-masking** compares the warped error with the error of the unwarped support frame, and keeps only the pixels where the warp actually helps:

$$
\mathcal M = \big[\, \min_s \mathcal L_{\text{photo}}(I_{\text{ref}}, \hat I^{s}_{\text{ref}}) < \min_s \mathcal L_{\text{photo}}(I_{\text{ref}}, I_s) \,\big].
$$

### Multi-scale training

The decoder predicts depth at four resolutions. Computing the loss at every scale, after upsampling each depth map to full resolution, gives coarse global guidance early in training and fine detail later.

### Everything together

$$
\mathcal L = \sum_{s=0}^{3} \Big( \mathcal L^{\text{masked},\,s}_{\text{photo}} + \lambda^s_{\text{smooth}}\, \mathcal L^s_{\text{smooth}} \Big).
$$

That is the whole recipe: raw video in, depth and ego-motion out, no labels. Its one fundamental limit is the one the geometry predicted: scaling the scene and the motion together leaves the loss unchanged, so depth is only known up to scale. Recovering metres is what [GroCo](/papers/groco/) does.
