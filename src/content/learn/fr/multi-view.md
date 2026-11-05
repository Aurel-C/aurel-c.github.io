---
title: Apprendre la profondeur à partir de vidéo
summary: Stéréo, géométrie épipolaire et structure à partir du mouvement, puis comment les réseaux auto-supervisés en font un signal d'apprentissage en déformant une image vers une autre.
chapter: 3
order: 2
---

Les annotations de profondeur denses coûtent cher : il faut des LiDAR ou des capteurs à lumière structurée, un étalonnage soigné et beaucoup de post-traitement. Les méthodes auto-supervisées s'en passent complètement. L'idée : une vidéo prise par une caméra en mouvement contient déjà la géométrie. **Si l'on connaît la profondeur d'une image et le mouvement de la caméra, on peut prédire à quoi ressemble l'image suivante.** On compare cette prédiction à la vraie image, et l'erreur devient le signal d'apprentissage.

Cette page rappelle d'abord la géométrie classique derrière cette idée, puis montre comment elle devient une fonction de perte différentiable.

## Deux vues d'une même scène

### Stéréo et disparité

Regardez un arbre depuis deux positions légèrement différentes. Il se décale entre les deux vues, et plus il est proche, plus il se décale. Ce décalage est la **disparité**.

<figure class="diagram">
  <img src="/figures/learn/disparity.svg" alt="Le même arbre vu depuis deux positions de caméra" loading="lazy">
  <figcaption>Disparité : le décalage horizontal d'un même point entre deux vues rectifiées, inversement proportionnel à la profondeur.</figcaption>
</figure>

Pour une paire stéréo rectifiée (deux caméras côte à côte, parfaitement alignées) de base $B$ et de focale $f$, disparité $d$ et profondeur sont liées par

$$
Z = \frac{f B}{d}.
$$

À cause du $1/d$, une erreur d'un pixel ne compte presque pas de près et devient des mètres au loin.

### Géométrie épipolaire

Avant de trianguler, il faut savoir quel pixel d'une image correspond à quel pixel de l'autre. La géométrie restreint la recherche. Les deux centres de caméra $C_1$, $C_2$ et le point 3D $P$ définissent un plan, qui coupe chaque image selon une **droite épipolaire**. Le correspondant de $p_1$ se trouve forcément sur la droite $l_2$ : une recherche 2D devient 1D.

<figure class="diagram">
  <img src="/figures/learn/epipolar_geometry.svg" alt="Plan épipolaire, droites épipolaires et épipôles entre deux caméras" loading="lazy">
  <figcaption>Géométrie épipolaire. Pour un point de la première image, son correspondant est sur une droite de la seconde.</figcaption>
</figure>

Algébriquement, en coordonnées normalisées $\tilde x = K^{-1}\tilde p$, toute correspondance correcte vérifie

$$
\tilde x_2^\top E\, \tilde x_1 = 0, \qquad E = [\mathbf t]_\times R,
$$

où $E$ est la **matrice essentielle** et $(R, \mathbf t)$ la pose relative. L'équation est inchangée si l'on multiplie $\mathbf t$ par n'importe quel facteur : $E$ a 5 degrés de liberté et non 6. **La translation, et donc l'échelle de la scène, ne se retrouvent qu'à un facteur près.** C'est la même ambiguïté d'échelle qu'en [profondeur monoculaire](/fr/learn/mono-depth/), qui vient cette fois de la géométrie.

### Structure à partir du mouvement

La structure à partir du mouvement (SfM) applique la même géométrie à des images successives d'une seule caméra mobile. La base n'est plus fixe : c'est le mouvement de la caméra, qu'il faut aussi estimer. Une chaîne classique :

1. détecter et apparier des points d'intérêt entre images (SIFT, ORB, ou des appariements appris comme SuperPoint et LoFTR) ;
2. estimer la pose relative de façon robuste avec RANSAC, car beaucoup d'appariements sont faux ;
3. trianguler les points 3D, recaler les nouvelles images par Perspective-n-Point ;
4. tout affiner par **ajustement de faisceaux**, qui minimise l'erreur de reprojection de tous les points dans toutes les vues.

<figure>
  <img src="/figures/learn/matches.webp" alt="Appariements de points entre deux images successives" loading="lazy">
  <figcaption>Correspondances entre deux images, obtenues avec LoFTR.</figcaption>
</figure>

La SfM est précise mais clairsemée, lente et fragile en cas de faible parallaxe, de zones sans texture et d'objets mobiles. L'apprentissage auto-supervisé de la profondeur garde son principe et remplace l'appariement et l'ajustement de faisceaux par deux réseaux de neurones et une perte photométrique dense.

## Apprendre profondeur et pose

<figure class="diagram">
  <img src="/figures/learn/ssl_pipeline.svg" alt="Chaîne auto-supervisée avec réseau de profondeur, réseau de pose, déformation et perte photométrique" loading="lazy">
  <figcaption>La chaîne auto-supervisée. Un réseau de profondeur et un réseau de pose prédisent la géométrie, qui sert à déformer l'image support vers la vue de référence. L'erreur photométrique entre les deux entraîne les deux réseaux.</figcaption>
</figure>

Un **réseau de profondeur** prédit la profondeur de l'image de référence $I_{\text{ref}}$. Un **réseau de pose** prédit le mouvement de la caméra $(R, \mathbf t)$ vers une image voisine $I_{\text{sup}}$. Avec ces deux sorties, l'image support est déformée vers le point de vue de référence et comparée à la vraie. Le tout fonctionne comme un auto-encodeur dont le goulot d'étranglement est la géométrie.

### L'équation de reprojection

<figure class="diagram">
  <img src="/figures/learn/reprojection_pipeline.svg" alt="Rétroprojeter avec la profondeur, transformer avec la pose, projeter dans l'image support" loading="lazy">
  <figcaption>Reprojection : remonter un pixel en 3D avec sa profondeur, le déplacer avec la pose relative, le projeter dans l'image support.</figcaption>
</figure>

Trois étapes envoient un pixel de référence $\tilde{\mathbf p} = (u, v, 1)$ dans l'image support :

$$
\mathbf P_{\text{ref}} = Z(\mathbf p)\,K^{-1}\tilde{\mathbf p}, \qquad
\mathbf P_{\text{sup}} = R\,\mathbf P_{\text{ref}} + \mathbf t, \qquad
\mathbf p_{\text{sup}} = \pi(K\,\mathbf P_{\text{sup}}),
$$

où $\pi$ divise par la profondeur. En une ligne :

$$
\mathbf p_{\text{sup}} = \pi\!\left( K \left[ R\, Z(\mathbf p)\, K^{-1} \tilde{\mathbf p} + \mathbf t \right] \right).
$$

### La reprojection est un flot optique rigide

Le déplacement $\mathbf f = \mathbf p_{\text{sup}} - \mathbf p$ est un flot optique, mais contraint : il est entièrement déterminé par la profondeur et le mouvement de la caméra, en supposant la scène statique. Pour une translation pure, son amplitude vaut environ

$$
\lVert \mathbf f \rVert \propto \frac{\lVert \mathbf t \rVert}{Z}.
$$

Les objets proches bougent plus que les lointains : c'est cette **parallaxe de mouvement** qui permet aux réseaux de séparer profondeur et mouvement. La rotation ajoute un flot qui ne dépend pas du tout de la profondeur, donc la profondeur s'apprend sur la partie translationnelle.

<figure class="pair">
  <img src="/figures/learn/flow_stereo_color.webp" alt="Amplitude du flot rigide pour une translation latérale" loading="lazy">
  <img src="/figures/learn/flow_stereo_arrows.webp" alt="Vecteurs du flot rigide pour une translation latérale" loading="lazy">
  <figcaption>Flot rigide pour une translation latérale (une paire stéréo) : les objets proches bougent le plus.</figcaption>
</figure>

<figure class="pair">
  <img src="/figures/learn/flow_forward_color.webp" alt="Flot rigide coloré par direction pour un mouvement vers l'avant" loading="lazy">
  <img src="/figures/learn/flow_forward_arrows.webp" alt="Vecteurs du flot rigide pour un mouvement vers l'avant" loading="lazy">
  <figcaption>Flot rigide pour un mouvement vers l'avant, typique d'une voiture. La teinte code la direction, la saturation l'amplitude ; le flot s'écarte depuis le centre.</figcaption>
</figure>

### Déformation inverse

Pour construire l'image de référence synthétique, on serait tenté d'envoyer chaque pixel de référence là où il tombe dans l'image support. Cette **déformation directe** laisse des trous là où rien n'arrive et des collisions là où plusieurs pixels tombent au même endroit. La **déformation inverse** fait le chemin opposé : pour chaque pixel de la grille de référence, on calcule où il tombe dans l'image support et on *va chercher* la couleur à cet endroit. Chaque pixel de sortie reçoit exactement une valeur.

<figure class="pair">
  <img src="/figures/learn/forward_warp.webp" alt="Résultat de la déformation directe avec des trous" loading="lazy">
  <img src="/figures/learn/inverse_warp.webp" alt="Résultat de la déformation inverse" loading="lazy">
  <figcaption>La déformation directe (à gauche) laisse trous et collisions. La déformation inverse (à droite) remplit chaque pixel, même si les zones occultées peuvent apparaître dédoublées.</figcaption>
</figure>

$$
\hat I_{\text{ref}}(\mathbf p) = I_{\text{sup}}\big(\text{reproject}(\mathbf p, Z(\mathbf p), R, \mathbf t)\big).
$$

Si la profondeur est surestimée, le déplacement est trop petit ; sous-estimée, trop grand. Dans les deux cas l'image déformée est mal alignée, et l'erreur indique au réseau dans quel sens corriger.

### Échantillonnage différentiable

Les coordonnées reprojetées ne sont pas entières : un pixel peut tomber en $(15.7, 23.3)$. Sa couleur s'obtient par **interpolation bilinéaire** des quatre pixels voisins, avec les décalages fractionnaires $\alpha, \beta$ :

$$
I(u', v') = \begin{bmatrix} 1-\alpha & \alpha \end{bmatrix}
\begin{bmatrix} I_{00} & I_{01} \\ I_{10} & I_{11} \end{bmatrix}
\begin{bmatrix} 1-\beta \\ \beta \end{bmatrix}.
$$

<figure class="diagram">
  <img src="/figures/learn/bilinear_interpolation.svg" alt="Interpolation bilinéaire entre quatre pixels" loading="lazy">
  <figcaption>Interpolation bilinéaire : le poids de chaque voisin est l'aire du rectangle opposé.</figcaption>
</figure>

Cette opération est différentiable par rapport à $(u', v')$, ce qui ferme la boucle : un petit changement de profondeur déplace le point d'échantillonnage, ce qui change la couleur, ce qui change la perte. Les gradients remontent de l'erreur image jusqu'à la profondeur et à la pose. En PyTorch, toute cette étape tient en un seul `grid_sample`.

## La fonction de perte

### Erreur photométrique : SSIM + L1

Une perte L2 sur les couleurs est dominée par les valeurs aberrantes (occultations, voitures en mouvement, reflets). L1 est plus robuste, et SSIM compare la structure locale (moyenne, contraste, corrélation) plutôt que les intensités brutes, ce qui la rend tolérante aux changements d'éclairage. Le mélange standard est

$$
\mathcal L_{\text{photo}} = \alpha\,\frac{1 - \text{SSIM}(I_{\text{ref}}, \hat I_{\text{ref}})}{2} + (1-\alpha)\,\lvert I_{\text{ref}} - \hat I_{\text{ref}} \rvert, \qquad \alpha = 0.85.
$$

### Lissage guidé par les contours

Sur les zones sans texture, la perte photométrique dit peu de choses, donc une régularisation favorise une profondeur lisse, sauf là où l'image elle-même a des contours :

$$
\mathcal L_{\text{smooth}} = \lvert \partial_x \bar D \rvert\, e^{-\lvert \partial_x I \rvert} + \lvert \partial_y \bar D \rvert\, e^{-\lvert \partial_y I \rvert}, \qquad \bar D = D / \text{mean}(D).
$$

La division par la moyenne empêche le réseau de tricher en réduisant toutes les profondeurs. Ce terme aide les métriques image mais tend à flouter les frontières des objets en 3D, l'une des motivations de l'[article sur les contours nets](/fr/papers/sob/).

### Reprojection minimale et masquage automatique

Monodepth2 a ajouté deux astuces simples, devenues standard. D'abord, utiliser l'image précédente *et* la suivante, et garder le **minimum par pixel** des deux erreurs. Un point caché dans l'image précédente est en général visible dans la suivante, donc les occultations sont en grande partie gérées sans effort.

Ensuite, certains pixels ne bougent pas du tout : le ciel, ou une voiture qui roule à la même vitesse que la caméra. Pour eux, prédire une profondeur infinie donne une erreur presque nulle, ce qui apprend n'importe quoi au réseau. Le **masquage automatique** compare l'erreur après déformation à celle de l'image support non déformée, et ne garde que les pixels où la déformation aide vraiment :

$$
\mathcal M = \big[\, \min_s \mathcal L_{\text{photo}}(I_{\text{ref}}, \hat I^{s}_{\text{ref}}) < \min_s \mathcal L_{\text{photo}}(I_{\text{ref}}, I_s) \,\big].
$$

### Apprentissage multi-échelle

Le décodeur prédit la profondeur à quatre résolutions. Calculer la perte à chaque échelle, après avoir suréchantillonné chaque carte à pleine résolution, donne un guidage global grossier en début d'entraînement et des détails fins ensuite.

### Tout ensemble

$$
\mathcal L = \sum_{s=0}^{3} \Big( \mathcal L^{\text{masked},\,s}_{\text{photo}} + \lambda^s_{\text{smooth}}\, \mathcal L^s_{\text{smooth}} \Big).
$$

Voilà toute la recette : de la vidéo brute en entrée, la profondeur et le mouvement propre en sortie, sans annotation. Sa seule limite fondamentale est celle que la géométrie annonçait : agrandir la scène et le mouvement ensemble ne change pas la perte, donc la profondeur n'est connue qu'à un facteur d'échelle près. Retrouver les mètres, c'est ce que fait [GroCo](/fr/papers/groco/).
