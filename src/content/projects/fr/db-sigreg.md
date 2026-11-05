---
title: DB-SIGReg
summary: "SIGReg à double tampon : la régularisation par distribution des grands batchs, sur un seul GPU. Un tampon fantôme prépare de nouveaux axes de projection pendant que le tampon actif fournit des gradients stables."
thumb: sig
tags: [SSL, JEPA]
status: document de travail
pdf: /files/db_sigreg.pdf
order: 2
---

## Contexte

Les méthodes à plongements joints comme LeJEPA évitent l'effondrement des représentations en poussant les plongements d'un batch vers une gaussienne isotrope. Le test utilisé, SIGReg, compare la fonction caractéristique empirique du batch à celle d'une loi normale standard, $\varphi(t) = e^{-t^2/2}$, le long de projections 1D aléatoires :

$$
\mathcal{L}_{EP} = \sum_{k=1}^{T} w_k \left|\frac{1}{B}\sum_{j=1}^{B} e^{i t_k z_j} - e^{-t_k^2/2}\right|^2 .
$$

D'après le théorème de Cramér–Wold, une distribution est gaussienne si et seulement si toutes ses projections 1D le sont. Le problème : une distribution est une propriété du batch entier, donc l'estimation n'est stable qu'avec de très grands batchs (des milliers d'exemples), qu'un seul GPU ne peut pas contenir.

## Le piège de l'espace nul

La solution évidente est d'accumuler les statistiques en cosinus et sinus sur plusieurs petits batchs, comme une moyenne mobile. Cela ne marche que si les axes de projection restent fixes. Or, avec des axes fixes, l'encodeur apprend à cacher des directions effondrées dans l'espace nul entre eux : chaque projection a l'air gaussienne alors que l'espace complet est dégénéré. Il faut donc retirer les axes, ce qui invalide les statistiques accumulées.

## Le double tampon

DB-SIGReg emprunte le double tampon à l'infographie et aux systèmes :

- Le **tampon actif** a une matrice de projection fixe et des statistiques accumulées sur de nombreux pas. Il fournit la perte et des gradients stables.
- Le **tampon fantôme** a des axes fraîchement tirés. Il accumule seulement des statistiques, en silence, sans produire de gradients.

Tous les $K$ pas, le tampon actif est abandonné, le fantôme devient actif et un nouveau fantôme démarre. Les axes tournent en permanence, il n'y a donc pas d'espace nul où se cacher, et les gradients viennent toujours d'une estimation mûre sur un grand nombre d'exemples.

Le document montre aussi que traiter l'estimation accumulée comme une constante détachée transforme l'erreur quadratique du batch en une pseudo-perte indépendante par exemple, ce qui rend valide une simple accumulation de gradients.

## État

Un document de travail et un banc d'essai PyTorch compact (SIGReg contre DB-SIGReg sur CIFAR-10/100 et STL-10, avec encodeurs CNN, ResNet-18 et petit ViT, sonde linéaire et mesures de mémoire et de débit). Les expériences sont en cours.
