---
title: FlowNCA
summary: A neural cellular automaton that estimates optical flow between two frames using only local 3×3 asynchronous updates. A first step toward event cameras, where local asynchronous computation fits naturally.
thumb: nca
tags: [NCA, optical flow, PyTorch]
status: in progress
order: 1
---

## The question

Optical flow networks like RAFT look at the whole image through correlation volumes and large receptive fields. Neural cellular automata (NCAs) do the opposite: every pixel is a small cell that only sees its 3×3 neighbours and updates itself with the same tiny network, over and over. Can such a strictly local system estimate how each pixel moved between two frames?

The long-term motivation is **event cameras**. They do not produce frames; each pixel fires on its own when its brightness changes. A model where every cell updates locally and asynchronously would fit that sensor much better than a frame-based CNN.

## How it works

Each cell carries a state vector:

- the two RGB frames and a constant channel (frozen inputs, 7 channels),
- the current flow estimate (2 channels),
- 24 hidden channels the model can use as memory.

At every step, four learned 3×3 convolutions perceive the neighbourhood, a small MLP (132 → 128 → 26) proposes an update, and each cell applies it with probability 0.75. That randomness makes the automaton asynchronous: there is no global clock. Information travels at most one pixel per step, so the flow has to be built up by local message passing, much like a classical Horn–Schunck solver. The whole model has about 60k parameters.

Training follows the replay-pool recipe from recent NCA reasoning work: states are stored in a pool and resumed later, with random damage, noise and target swaps, so the automaton learns to keep improving and to repair itself rather than to stop at a fixed step count.

## Data

A synthetic "FlyingChairs-lite" generator builds each sample on the fly: a photo background and one to three textured blobs, each with its own affine motion. Because the motion is generated, the ground-truth flow is exact. Training and validation use disjoint sets of photos.

## Status

This is a proof of concept at low resolution (32 px), compared with zero flow, Horn–Schunck, Farnebäck and DIS. State-of-the-art accuracy is not the goal. The questions are whether the automaton converges, whether it keeps improving with more steps at test time, and whether a model trained at 32 px runs unchanged at 64 px. Results will be added here.
