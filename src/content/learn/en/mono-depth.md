---
title: What is monocular depth estimation?
summary: Depth maps and point clouds, the visual cues that let one image carry 3D information, the pinhole camera model, and how depth networks are built and evaluated.
chapter: 2
order: 1
---

## Depth map and point cloud

Depth estimation means finding, for each pixel, how far the scene point it sees is from the camera. Doing it from a **single** RGB image is called *monocular* depth estimation. The result is a dense **depth map**: an image where each value is a distance.

<figure class="pair">
  <img src="/figures/learn/image.webp" alt="A street image from KITTI" loading="lazy">
  <img src="/figures/learn/depth.webp" alt="Its depth map" loading="lazy">
  <figcaption>An image and its depth map. Warm colours are close, cool colours are far.</figcaption>
</figure>

If you also know the camera's internal parameters, every pixel can be pushed back into 3D along its viewing ray. The result is a **point cloud**, the representation robots, cars and AR devices actually reason with. The [3D view on the home page](/) is built exactly this way.

<figure>
  <img src="/figures/learn/pointcloud.webp" alt="A coloured point cloud reconstructed from one image" loading="lazy">
  <figcaption>A point cloud from one image and its depth. The empty shadows behind trees and cars are regions the camera never saw.</figcaption>
</figure>

## Why one image is enough (most of the time)

A photo is a flat projection of a 3D world. Infinitely many scenes produce the same picture, so monocular depth is, strictly speaking, **ill-posed**. People still judge depth with one eye closed, because images are full of cues. It helps to separate three kinds of depth information:

- **Ordinal**: A is in front of B.
- **Relative**: B is twice as far as A.
- **Metric**: A is at 12 m.

Most cues only give the first two. Metric depth needs extra knowledge such as the real size of an object or the camera's height above the ground.

<figure class="pair">
  <img src="/figures/learn/cue_size.webp" alt="Two cubes of different apparent size" loading="lazy">
  <img src="/figures/learn/cue_occlusion.webp" alt="One cube occluding another" loading="lazy">
  <figcaption>Relative size (left): the bigger cube looks closer, assuming both cubes are the same size. Occlusion (right): the red cube hides the blue one, so it is in front.</figcaption>
</figure>

**Relative and familiar size.** Things look smaller when they are farther away. On its own this is ambiguous, because image size depends on both distance and real size. If you know the object (a car, a person, a stop sign), it becomes a *familiar size* cue and can even give approximate metric distance.

**Occlusion.** An object that hides another is in front of it. This is one of the strongest cues, but it says nothing about *how much* closer.

<figure class="pair">
  <img src="/figures/learn/cue_linear.webp" alt="Railway tracks converging to a vanishing point" loading="lazy">
  <img src="/figures/learn/cue_texture.webp" alt="A checkerboard ground getting denser with distance" loading="lazy">
  <figcaption>Linear perspective (left) and texture gradient (right).</figcaption>
</figure>

**Linear perspective.** Parallel lines in the world, such as rails or lane markings, meet at a vanishing point in the image. **Texture gradient.** A regular texture on a receding surface gets denser and finer with distance.

<figure class="pair">
  <img src="/figures/learn/cue_height.webp" alt="Two cubes on a floor at different heights in the image" loading="lazy">
  <img src="/figures/learn/cue_shadow.webp" alt="A cube casting a shadow on another" loading="lazy">
  <figcaption>Height in the visual field (left) and cast shadows (right).</figcaption>
</figure>

**Height in the visual field.** For objects standing on the ground, the higher the contact point in the image (closer to the horizon), the farther the object. This cue is purely geometric, and combined with the camera height it gives *metric* depth. It is the basis of [GroCo](/papers/groco/). **Cast shadows** reveal how objects are arranged relative to each other and to the light.

<figure class="small" style="--w:330px">
  <img src="/figures/learn/cue_atmosphere.webp" alt="Mountains getting hazier and bluer with distance" loading="lazy">
  <figcaption>Atmospheric perspective: distant mountains are hazier and bluer.</figcaption>
</figure>

**Atmospheric perspective.** Far objects look hazier, less saturated and bluer because light scatters in the air. It is useful in landscapes and unreliable elsewhere.

All these cues are things a network has to learn implicitly. And one ambiguity never goes away: without extra information, a photo of a miniature model looks the same as the real scene. That is the **scale ambiguity**, and it comes back in every chapter of the thesis.

## The pinhole camera

To go between pixels and 3D points we need a model of the camera. The standard one is the **pinhole**: light from each scene point passes through a single tiny hole and lands on the sensor, like light through the pupil onto the retina.

<figure class="diagram">
  <img src="/figures/learn/pinhole_camera.svg" alt="Pinhole camera compared with the human eye" loading="lazy">
  <figcaption>Rays pass through the pinhole (or the pupil) and form an inverted image on the sensor (or the retina).</figcaption>
</figure>

Real cameras have lenses, but for normal fields of view a pinhole with the right focal length is a good approximation. Wide-angle and fisheye lenses bend rays and need a distortion model first.

### Intrinsics

The camera is described by its **focal length** $f$ (in pixels) and its **principal point** $(c_x, c_y)$, where the optical axis meets the sensor. They form the intrinsic matrix:

$$
K = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}.
$$

A 3D point $P = (X, Y, Z)$ in the camera frame projects to pixel $(u, v)$ by

$$
Z \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = K \begin{bmatrix} X \\ Y \\ Z \end{bmatrix}
\quad\Longleftrightarrow\quad
u = f_x \frac{X}{Z} + c_x, \qquad v = f_y \frac{Y}{Z} + c_y .
$$

Everything depends on the ratios $X/Z$ and $Y/Z$: this division by depth is what flattens the world. It is easier to see on the *normalised image plane*, a virtual plane at $Z = 1$ in front of the camera.

<figure class="diagram">
  <img src="/figures/learn/normalized_plane.svg" alt="The normalised image plane at Z equals 1" loading="lazy">
  <figcaption>The normalised plane: a point projects to (X/Z, Y/Z, 1), and K then scales and shifts it into pixels.</figcaption>
</figure>

A direct consequence: an object of width $W$ at distance $Z$ appears $w = f_x W / Z$ pixels wide. Double the distance, halve the size. That is the relative-size cue written as an equation.

<figure class="small" style="--w:360px">
  <img src="/figures/learn/perspective.webp" alt="Identical objects at increasing depth getting smaller" loading="lazy">
  <figcaption>Identical objects at increasing depth get proportionally smaller.</figcaption>
</figure>

### Depth or distance?

"Depth" can mean two things. In Cartesian coordinates it is $Z$, the distance along the optical axis. In spherical coordinates it is the range $\rho = \sqrt{X^2+Y^2+Z^2}$, the straight-line distance to the camera. For normal cameras $Z$ is standard; for fisheye lenses, where points at the image edge have $Z \approx 0$, the range is more natural.

<figure class="diagram">
  <img src="/figures/learn/cartesian_vs_spherical.svg" alt="Cartesian depth Z versus spherical range rho" loading="lazy">
  <figcaption>Cartesian depth <i>Z</i> against spherical range <i>ρ</i>.</figcaption>
</figure>

### Extrinsics and coordinate frames

The camera also has a position and orientation: a rotation $R$ and a translation $t$ that map a point from the world (or vehicle) frame to the camera frame, $P_c = R P_w + t$. Together with $K$ this gives the full projection

$$
Z \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = K\,[R \mid t] \begin{bmatrix} X_w \\ Y_w \\ Z_w \\ 1 \end{bmatrix}.
$$

<figure class="diagram">
  <img src="/figures/learn/coordinate_frames.svg" alt="Ego, camera and image coordinate frames on a vehicle" loading="lazy">
  <figcaption>The ego (vehicle) frame, the camera frame (Z forward, X right, Y down), and the image frame (origin top-left).</figcaption>
</figure>

### From depth map to point cloud

Inverting the projection gives the point cloud: each pixel, scaled by its depth along its ray,

$$
P_{u,v} = \mathcal{Z}_{u,v}\; K^{-1} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix}.
$$

Attach the pixel's colour and you get the coloured clouds shown above.

## How depth networks are built

Almost every depth network is an **encoder–decoder**. The encoder, usually pretrained on ImageNet (a ResNet, ConvNeXt or ViT), turns the image into increasingly abstract, lower-resolution features. The decoder upsamples them back to full resolution, with skip connections bringing in fine detail from early layers. U-Net-style decoders, as in Monodepth2 and HR-Depth, are the common choice in self-supervised work.

Two output choices matter more than they look:

- **What to predict.** Plain regression gives one value per pixel. Classification over depth bins (as in DORN or AdaBins) gives a distribution, which can express ambiguity. My [BMVC paper](/papers/sob/) sits in between: a two-component mixture per pixel.
- **In which space.** Raw depth treats all ranges equally. **Disparity** (inverse depth) is linear in pixel shift between views, makes planes linear, and gives more resolution close to the camera, which is why most self-supervised methods use it. Log-depth suits scenes with very large depth ranges.

## How depth is evaluated

The standard metrics compare predicted depth $\hat z_i$ with LiDAR ground truth $z_i$ on the valid pixels:

| Metric | Formula | Notes |
|---|---|---|
| AbsRel | $\frac{1}{N}\sum \lvert\hat z_i - z_i\rvert / z_i$ | relative error, emphasises near range |
| SqRel | $\frac{1}{N}\sum (\hat z_i - z_i)^2 / z_i^2$ | penalises large errors |
| RMSE | $\sqrt{\frac{1}{N}\sum (\hat z_i - z_i)^2}$ | in metres |
| RMSE log | $\sqrt{\frac{1}{N}\sum (\log\hat z_i - \log z_i)^2}$ | less sensitive to far range |
| δ < 1.25ᵏ | share of pixels with $\max(\hat z/z,\ z/\hat z) < 1.25^k$ | accuracy, robust to outliers |

Self-supervised models are usually evaluated after **median scaling**: each prediction is rescaled so its median matches the ground truth, which hides the scale ambiguity. Metric methods such as GroCo are evaluated without it, which is harder.

When the depth is used to build 3D maps, point-cloud metrics are more telling: **Chamfer distance** (average nearest-neighbour distance in both directions), and **F-score** or **IoU** at a distance threshold. They punish the floating points at object edges that image metrics barely notice.

## Sensors and datasets

Ground truth comes from depth sensors: **LiDAR** (accurate, long range, but sparse), **stereo cameras** (dense, but accuracy drops with distance), **time-of-flight** and **structured light** (dense, mostly indoors). The benchmarks used in the thesis are **KITTI** (cars in Karlsruhe, stereo and LiDAR), **VKITTI2** (a synthetic copy of KITTI with perfect depth), **DDAD** (six cameras and long-range LiDAR, useful to test new viewpoints) and **NYUv2** (indoor scenes).

Next: [how a network can learn depth from video alone](/learn/multi-view/).
