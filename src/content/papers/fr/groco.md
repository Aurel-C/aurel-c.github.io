---
title: "GroCo: Ground Constraint for Metric Self-Supervised Monocular Depth"
venue: ECCV
year: 2024
authors: A. Cecille, S. Duffner, F. Davoine, T. Neveu, R. Agier
tldr: Retrouve une profondeur à l'échelle métrique avec une seule caméra et sans annotation, grâce à un a priori sur le plan du sol. Meilleure généralisation entre jeux de données et positions de caméra.
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

## Résumé

L'estimation de profondeur monoculaire a beaucoup progressé ces dernières années, mais les modèles qui prédisent une profondeur métrique peinent encore à généraliser à des poses de caméra et des jeux de données variés. Des méthodes supervisées récentes atténuent ce problème en exploitant un a priori sur le sol à l'inférence, mais elles s'adaptent mal à l'auto-supervision, où il faut en plus retrouver l'échelle. Nous proposons une contrainte sur les zones de sol conçue spécifiquement pour l'auto-supervision. Elle permet de retrouver précisément l'échelle et garantit la cohérence entre la profondeur prédite et l'a priori sur le sol. Notre méthode dépasse les techniques existantes de récupération d'échelle sur KITTI et améliore nettement la généralisation : elle est plus robuste aux rotations de la caméra et s'adapte en zéro-shot à des jeux de données jamais vus, comme DDAD.

## Pourquoi l'échelle manque

Un réseau de profondeur entraîné sur de la vidéo apprend en déformant une image vers une autre. Si l'on multiplie toutes les profondeurs et la translation de la caméra par un même facteur $\lambda$, la déformation est identique : le signal d'apprentissage ne distingue pas une maquette d'une vraie rue. Les modèles auto-supervisés ne sont donc justes qu'*à un facteur d'échelle près*.

Le sol résout ce problème. Avec la hauteur $h$ et l'orientation de la caméra, chaque pixel sous l'horizon a une profondeur connue, *à condition* qu'il soit sur une route plane :

$$
G(u, v) = \frac{h}{\mathbf{r}_2^\top K^{-1}\,[u, v, 1]^\top},
$$

où $\mathbf{r}_2^\top$ est la ligne de la rotation de la caméra qui pointe vers le sol. La difficulté est de savoir quels pixels sont de la route. Voitures, trottoirs et murs cassent l'a priori, et rien dans l'auto-supervision ne dit où ils sont.

## Méthode

La profondeur analytique du sol $G$ est donnée au réseau comme quatrième canal, à côté de l'image RGB : le modèle sait où regarde la caméra. Il prédit une carte de profondeur $\hat Z$ et une carte d'attention $\alpha \in [0,1]$, et la profondeur finale mélange les deux :

$$
Z_i = (1-\alpha_i)\,\hat Z_i + \alpha_i\,G_i .
$$

Seul, ce mécanisme s'effondre : la solution la plus simple est $\alpha = 0$ partout. La clé est la **perte de contrainte au sol**, qui lie la récupération de l'échelle et la sélection du sol :

$$
\mathcal{L}_{\text{const}} = \frac{1}{N}\sum_i \alpha_i^2\,\big|\hat Z_i - G_i\big| .
$$

Là où l'attention est forte, la profondeur du réseau doit coïncider avec l'a priori métrique, ce qui ramène toute son échelle en mètres. Là où l'a priori est faux (une voiture, un mur), l'erreur est grande, activer l'attention coûterait cher, et l'attention apprend à rester éteinte. Le même terme enseigne l'échelle *et* l'emplacement de la route.

Une régularisation en borne inférieure empêche l'attention nulle partout sans l'imposer à un endroit précis :

$$
\mathcal{L}_{\text{reg}} = \frac{\max\!\big(0,\ \tau - \tfrac{1}{N}\sum_i \alpha_i^2\big)}{\tau^2},
$$

où $\tau$ est la proportion de l'image que l'on s'attend à voir occupée par la route, qui peut se déduire de la largeur de la voie et de la hauteur de la caméra. Les résultats restent stables sur une large plage de $\tau$.

<figure>
  <img src="/figures/papers/groco_seg.webp" alt="Attention au sol superposée à deux images KITTI" loading="lazy">
  <figcaption>Attention au sol apprise sans aucune annotation de segmentation. Même avec des obstacles proches, elle reste sur la route.</figcaption>
</figure>

## Résultats

Sur KITTI, parmi les méthodes qui n'utilisent que la hauteur de caméra pour l'échelle (sans recalage à l'évaluation) :

| KITTI, annotations d'origine | AbsRel ↓ | SqRel ↓ | RMSE ↓ | δ<1.25 ↑ |
|---|---|---|---|---|
| Scale Recovery | 0.123 | 0.996 | 5.253 | 0.840 |
| VADepth | 0.120 | 0.975 | 4.971 | 0.867 |
| **GroCo** | **0.113** | **0.851** | **4.756** | **0.870** |

Le vrai gain est la robustesse. Une méthode de référence, entraînée de la même façon avec augmentation par rotation, fait aussi bien sur les images KITTI standard, mais se dégrade dès que la caméra s'incline : elle a appris le point de vue habituel du jeu de données plutôt que la géométrie.

| AbsRel ↓ à l'évaluation | Aucune | Roulis 5° | Tangage −5° | Lacet 15° |
|---|---|---|---|---|
| Référence | 0.092 | 0.140 | 0.145 | 0.209 |
| **GroCo** | **0.089** | **0.101** | **0.086** | **0.136** |

<figure>
  <img src="/figures/papers/groco_rot.webp" alt="Profondeur prédite sous rotations de roulis, lacet et tangage" loading="lazy">
  <figcaption>Profondeur sous rotations de la caméra, et différence avec la référence. En rouge, la référence est moins bonne.</figcaption>
</figure>

Entraîné sur KITTI et testé en zéro-shot sur la caméra avant de DDAD (autre voiture, autre caméra, autre ville), l'AbsRel passe de 0,403 à 0,154 et δ<1,25 de 0,06 à 0,76. Entraîné sur la caméra avant de DDAD et testé sur ses autres caméras, GroCo dépasse aussi des méthodes supervisées qui tiennent compte de la caméra.

