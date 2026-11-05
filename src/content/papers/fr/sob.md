---
title: Towards Sharper Object Boundaries in Self-Supervised Depth Estimation
venue: BMVC
year: 2025
award: Oral
authors: A. Cecille, S. Duffner, F. Davoine, R. Agier, T. Neveu
tldr: Modélise la profondeur de chaque pixel par une distribution de mélange, ce qui supprime les contours flous et les points 3D parasites. Jusqu'à 35 % de contours plus nets sur KITTI et VKITTI2.
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

## Résumé

Une estimation précise de la profondeur monoculaire est essentielle à la compréhension 3D d'une scène, mais les méthodes existantes rendent souvent la profondeur floue aux frontières des objets, ce qui crée des points 3D intermédiaires parasites. Alors qu'obtenir des contours nets demande habituellement une supervision très fine, notre méthode produit des discontinuités nettes avec la seule auto-supervision. Nous modélisons la profondeur de chaque pixel par une distribution de mélange, qui représente plusieurs profondeurs plausibles et déplace l'incertitude de la régression vers les poids du mélange. Cette formulation s'intègre directement aux chaînes existantes grâce à des fonctions de perte tenant compte de la variance et à la propagation d'incertitude. Sur KITTI et VKITTIv2, notre méthode obtient des contours jusqu'à 35 % plus nets et de meilleurs nuages de points que les méthodes de l'état de l'art.

<figure>
  <img src="/figures/papers/sob_pcd_comp.webp" alt="Nuages de points de HR-Depth et de notre modèle sur une rue de KITTI" loading="lazy">
  <figcaption>Nuages de points reconstruits à partir de la profondeur prédite. La méthode de référence (à gauche) laisse des traînées de points flottants entre les piétons et le fond ; la nôtre (à droite) coupe proprement.</figcaption>
</figure>

## Le problème : une profondeur « entre les deux »

Prenons un arbre devant une maison. Au bord du tronc, un pixel voit un peu des deux, et un réseau entraîné par régression fait un compromis : il prédit une profondeur à mi-chemin entre l'arbre et la maison. Cette valeur ne correspond à aucune surface. Sur la carte de profondeur, cela donne un contour flou ; en 3D, un rideau de points flottant dans le vide, exactement ce qu'un planificateur ou une carte d'occupation ne devrait jamais voir.

L'auto-supervision aggrave le phénomène : la perte photométrique passe par un échantillonnage bilinéaire et un terme de lissage, qui favorisent tous deux les transitions douces.

## L'idée : deux profondeurs par pixel

Au lieu d'une seule valeur, chaque pixel prédit un **mélange de deux gaussiennes** sur la disparité (l'inverse de la profondeur) :

$$
\mathcal{M}(z^{-1}) = w_1\,\mathcal{N}(z^{-1}\mid\mu_1,\sigma_1^2) + w_2\,\mathcal{N}(z^{-1}\mid\mu_2,\sigma_2^2), \qquad w_1 + w_2 = 1 .
$$

Le réseau produit cinq canaux : $\mu_1, \mu_2, \sigma_1^2, \sigma_2^2, w_1$. À une frontière, une composante peut porter le premier plan et l'autre l'arrière-plan : l'incertitude passe de la valeur de profondeur au poids. À l'inférence, on choisit la composante la plus probable au lieu de faire une moyenne :

$$
d^* = \begin{cases} \mu_1 & \text{si } w_1 > 0.5 \\ \mu_2 & \text{sinon.} \end{cases}
$$

Chaque moyenne reste presque constante de son côté du contour et seul le poids varie, donc la sélection crée une marche nette. Les paramètres peuvent aussi être suréchantillonnés à n'importe quelle résolution sans flouter le contour.

<figure>
  <img src="/figures/papers/sob_grid.webp" alt="Image d'entrée, profondeur prédite, poids du mélange et différence entre les deux moyennes" loading="lazy">
  <figcaption>(1) Entrée, (2) profondeur prédite, (3) poids du mélange (bleu = 0, blanc = 0,5, rouge = 1), (4) différence relative entre les deux moyennes. Les deux modes apparaissent exactement là où les objets rencontrent le fond.</figcaption>
</figure>

## Auto-supervision avec des distributions

Le signal d'apprentissage vient toujours de la reprojection d'une image voisine dans la vue courante (voir l'[explication sur l'auto-supervision](/fr/learn/multi-view/)). La différence est que chaque grandeur devient une distribution. On propage chaque composante par une approximation au premier ordre, comme dans un filtre de Kalman étendu :

$$
f(Z_k^{-1}) \sim \mathcal{N}\big(f(\mu_k),\, f'(\mu_k)^2\sigma_k^2\big).
$$

Reprojection et échantillonnage bilinéaire sont fusionnés en une seule fonction de la disparité vers la couleur ; sa dérivée est le gradient de l'image au point échantillonné multiplié par la dérivée de la reprojection. Chaque composante donne ainsi une moyenne et une variance de l'erreur photométrique $E_k$.

Les composantes sont ensuite mises en compétition. Le poids cible de la composante $k$ est la probabilité qu'elle explique mieux l'image que l'autre, qui s'écrit en forme close puisque la différence de deux gaussiennes est gaussienne :

$$
\bar w_k = P(E_k < E_{1-k}) = \Phi\!\left(\frac{\mu_{E_{1-k}} - \mu_{E_k}}{\sqrt{\sigma_{E_{1-k}}^2 + \sigma_{E_k}^2}}\right).
$$

La perte a trois termes : l'erreur photométrique habituelle sur la composante choisie, un terme qui aligne la variance prédite sur l'erreur observée, et une entropie croisée qui rapproche les poids de $\bar w_k$.

## Résultats

Toutes les méthodes ci-dessous utilisent le même encodeur ConvNeXt-Base et la même chaîne de données. Les métriques globales bougent peu, ce qui est attendu puisque les contours sont une petite fraction des pixels. Les métriques sur nuage de points s'améliorent, et la netteté des contours beaucoup.

| Netteté des contours ↓ (KITTI) | M | MS | S |
|---|---|---|---|
| Monodepth2 | 0.499 | 0.520 | 0.509 |
| **Nous (décodeur MD2)** | **0.350** | **0.336** | **0.387** |
| HR-Depth | 0.471 | 0.456 | 0.516 |
| **Nous (décodeur HR-Depth)** | **0.373** | **0.357** | **0.385** |

Le score de netteté est l'entropie de Bernoulli moyenne de la profondeur normalisée autour des contours de Canny : 0 pour une marche parfaite, 1 pour une rampe linéaire. M, S et MS désignent un entraînement sur vidéo monoculaire, sur paires stéréo, ou les deux.

| KITTI, monoculaire | AbsRel ↓ | Chamfer ↓ | F-score ↑ | IoU ↑ |
|---|---|---|---|---|
| Monodepth2 | 8.82 | 0.71 | 46.64 | 31.62 |
| HR-Depth | 8.65 | 0.69 | 47.35 | 32.10 |
| **Nous (décodeur HR-Depth)** | **8.50** | **0.66** | **48.46** | **33.11** |

<figure>
  <img src="/figures/papers/sob_zoom.webp" alt="Agrandissements de cartes de profondeur de HR-Depth et de notre modèle" loading="lazy">
  <figcaption>Agrandissements : HR-Depth à gauche de chaque paire, notre méthode en rouge. Panneaux, poteaux et silhouettes de voitures gardent leur forme.</figcaption>
</figure>

## Une incertitude en prime

Le mélange fournit aussi une incertitude calibrée. Par la loi de la variance totale, elle se décompose en dispersion de chaque composante et en désaccord entre elles, qui s'allume exactement sur les frontières d'occultation.

<figure>
  <img src="/figures/papers/sob_uncertainty.webp" alt="Profondeur le long d'une ligne de l'image avec bande d'incertitude, et cartes d'incertitude" loading="lazy">
  <figcaption>À gauche : profondeur le long d'une ligne de l'image avec sa distribution prédite et les points LiDAR. À droite : les deux parties de la variance prédite.</figcaption>
</figure>

