---
title: DB-SIGReg
summary: "Double-buffered SIGReg: large-batch distribution matching for self-supervised learning on a single GPU. A shadow buffer warms up fresh projection axes while the active one gives stable gradients."
thumb: sig
tags: [SSL, JEPA]
status: working paper
pdf: /files/db_sigreg.pdf
order: 2
---

## Background

Joint-embedding methods such as LeJEPA avoid representation collapse by pushing the embeddings of a batch towards an isotropic Gaussian. The test they use, SIGReg, compares the empirical characteristic function of the batch with that of a standard normal, $\varphi(t) = e^{-t^2/2}$, along random 1D projections:

$$
\mathcal{L}_{EP} = \sum_{k=1}^{T} w_k \left|\frac{1}{B}\sum_{j=1}^{B} e^{i t_k z_j} - e^{-t_k^2/2}\right|^2 .
$$

By the Cramér–Wold theorem, a distribution is Gaussian if and only if all its 1D projections are. The catch is that a distribution is a property of the whole batch, so the estimate is only stable with very large batches (thousands of samples), which a single GPU cannot hold.

## The null-space trap

The obvious fix is to accumulate the cosine and sine statistics over several small batches, like an exponential moving average. That only works if the projection axes stay fixed. But with fixed axes the encoder learns to hide collapsed directions in the null space between them: every projection looks Gaussian while the full space is degenerate. The axes must be re-sampled, and re-sampling invalidates the accumulated statistics.

## Double buffering

DB-SIGReg borrows double buffering from graphics and systems engineering:

- The **active buffer** has a fixed projection matrix and statistics accumulated over many steps. It provides the loss and stable gradients.
- The **shadow buffer** has freshly sampled axes. It only accumulates statistics, silently, without producing gradients.

Every $K$ steps the active buffer is discarded, the shadow becomes active, and a new shadow starts. The axes keep rotating, so there is no null space to hide in, yet the gradients always come from a mature large-sample estimate.

The paper also shows that treating the accumulated estimate as a detached constant turns the squared batch error into an independent pseudo-loss per sample, which makes plain gradient accumulation valid.

## Status

A working paper and a compact PyTorch harness (SIGReg baseline vs DB-SIGReg on CIFAR-10/100 and STL-10, with CNN, ResNet-18 and tiny ViT encoders, linear-probe accuracy and memory/throughput logging). Experiments are ongoing.
