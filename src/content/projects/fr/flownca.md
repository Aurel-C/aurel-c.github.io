---
title: FlowNCA
summary: Un automate cellulaire neuronal qui estime le flot optique entre deux images avec uniquement des mises à jour locales 3×3 asynchrones. Une première étape vers les caméras événementielles, où ce calcul local et asynchrone a tout son sens.
thumb: nca
tags: [NCA, flot optique, PyTorch]
status: en cours
order: 1
---

## La question

Les réseaux de flot optique comme RAFT regardent toute l'image à travers des volumes de corrélation et de grands champs récepteurs. Les automates cellulaires neuronaux (NCA) font l'inverse : chaque pixel est une petite cellule qui ne voit que ses 3×3 voisins et se met à jour avec le même petit réseau, encore et encore. Un système strictement local peut-il estimer le déplacement de chaque pixel entre deux images ?

La motivation à long terme, ce sont les **caméras événementielles**. Elles ne produisent pas d'images : chaque pixel émet un événement de lui-même quand sa luminosité change. Un modèle où chaque cellule se met à jour localement et de façon asynchrone conviendrait bien mieux à ce capteur qu'un CNN pensé pour des images.

## Fonctionnement

Chaque cellule porte un vecteur d'état :

- les deux images RGB et un canal constant (entrées figées, 7 canaux),
- l'estimation courante du flot (2 canaux),
- 24 canaux cachés que le modèle peut utiliser comme mémoire.

À chaque pas, quatre convolutions 3×3 apprises perçoivent le voisinage, un petit MLP (132 → 128 → 26) propose une mise à jour, et chaque cellule l'applique avec une probabilité de 0,75. Ce tirage rend l'automate asynchrone : il n'y a pas d'horloge globale. L'information avance d'au plus un pixel par pas, donc le flot doit se construire par échanges locaux, un peu comme un solveur classique de Horn–Schunck. Le modèle compte environ 60 000 paramètres.

L'entraînement reprend la recette du « replay pool » de travaux récents sur le raisonnement avec des NCA : les états sont stockés puis repris plus tard, avec des dégradations, du bruit et des changements de cible, pour que l'automate apprenne à continuer de s'améliorer et à se réparer plutôt qu'à s'arrêter après un nombre fixe de pas.

## Données

Un générateur synthétique façon « FlyingChairs allégé » crée chaque exemple à la volée : un fond photographique et une à trois formes texturées, chacune avec son propre mouvement affine. Le mouvement étant généré, le flot de référence est exact. Entraînement et validation utilisent des photos distinctes.

## État

C'est une preuve de concept en basse résolution (32 px), comparée au flot nul, à Horn–Schunck, Farnebäck et DIS. L'objectif n'est pas l'état de l'art. Les questions sont : l'automate converge-t-il, continue-t-il de s'améliorer avec plus de pas à l'inférence, et un modèle entraîné en 32 px fonctionne-t-il tel quel en 64 px ? Les résultats seront ajoutés ici.
