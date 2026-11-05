---
title: Qu'est-ce que l'estimation de profondeur monoculaire ?
summary: Cartes de profondeur et nuages de points, les indices visuels qui permettent à une seule image de contenir de l'information 3D, le modèle de caméra sténopé, et comment les réseaux de profondeur sont construits et évalués.
chapter: 2
order: 1
---

## Carte de profondeur et nuage de points

Estimer la profondeur, c'est trouver pour chaque pixel la distance entre la caméra et le point de la scène qu'il voit. Le faire à partir d'une **seule** image RGB s'appelle l'estimation de profondeur *monoculaire*. Le résultat est une **carte de profondeur** dense : une image dont chaque valeur est une distance.

<figure class="pair">
  <img src="/figures/learn/image.webp" alt="Une image de rue issue de KITTI" loading="lazy">
  <img src="/figures/learn/depth.webp" alt="Sa carte de profondeur" loading="lazy">
  <figcaption>Une image et sa carte de profondeur. Les couleurs chaudes sont proches, les couleurs froides lointaines.</figcaption>
</figure>

Si l'on connaît aussi les paramètres internes de la caméra, chaque pixel peut être replacé en 3D le long de son rayon de vue. On obtient un **nuage de points**, la représentation avec laquelle raisonnent réellement les robots, les voitures et les casques de réalité augmentée. La [vue 3D de la page d'accueil](/fr/) est construite exactement ainsi.

<figure>
  <img src="/figures/learn/pointcloud.webp" alt="Un nuage de points coloré reconstruit à partir d'une image" loading="lazy">
  <figcaption>Un nuage de points obtenu à partir d'une image et de sa profondeur. Les zones vides derrière les arbres et les voitures sont des régions que la caméra n'a jamais vues.</figcaption>
</figure>

## Pourquoi une image suffit (la plupart du temps)

Une photo est une projection plane d'un monde en 3D. Une infinité de scènes produisent la même image : au sens strict, la profondeur monoculaire est un problème **mal posé**. Pourtant, on juge les distances même avec un œil fermé, parce que les images regorgent d'indices. Il est utile de distinguer trois types d'information de profondeur :

- **Ordinale** : A est devant B.
- **Relative** : B est deux fois plus loin que A.
- **Métrique** : A est à 12 m.

La plupart des indices ne donnent que les deux premiers. La profondeur métrique demande une connaissance supplémentaire, comme la taille réelle d'un objet ou la hauteur de la caméra au-dessus du sol.

<figure class="pair">
  <img src="/figures/learn/cue_size.webp" alt="Deux cubes de tailles apparentes différentes" loading="lazy">
  <img src="/figures/learn/cue_occlusion.webp" alt="Un cube qui en cache un autre" loading="lazy">
  <figcaption>Taille relative (à gauche) : le grand cube paraît plus proche, si l'on suppose les deux cubes de même taille. Occultation (à droite) : le cube rouge cache le bleu, il est donc devant.</figcaption>
</figure>

**Taille relative et familière.** Les objets paraissent plus petits quand ils sont loin. Seul, cet indice est ambigu, car la taille dans l'image dépend à la fois de la distance et de la taille réelle. Si l'on connaît l'objet (une voiture, une personne, un panneau stop), il devient un indice de *taille familière* et peut même donner une distance métrique approximative.

**Occultation.** Un objet qui en cache un autre est devant lui. C'est l'un des indices les plus forts, mais il ne dit rien de l'écart entre les deux.

<figure class="pair">
  <img src="/figures/learn/cue_linear.webp" alt="Des rails convergeant vers un point de fuite" loading="lazy">
  <img src="/figures/learn/cue_texture.webp" alt="Un damier au sol de plus en plus dense avec la distance" loading="lazy">
  <figcaption>Perspective linéaire (à gauche) et gradient de texture (à droite).</figcaption>
</figure>

**Perspective linéaire.** Les droites parallèles du monde, comme des rails ou des marquages au sol, se rejoignent en un point de fuite dans l'image. **Gradient de texture.** Une texture régulière sur une surface qui s'éloigne devient plus dense et plus fine avec la distance.

<figure class="pair">
  <img src="/figures/learn/cue_height.webp" alt="Deux cubes au sol à des hauteurs différentes dans l'image" loading="lazy">
  <img src="/figures/learn/cue_shadow.webp" alt="Un cube projetant une ombre sur un autre" loading="lazy">
  <figcaption>Hauteur dans le champ visuel (à gauche) et ombres portées (à droite).</figcaption>
</figure>

**Hauteur dans le champ visuel.** Pour des objets posés au sol, plus le point de contact est haut dans l'image (proche de l'horizon), plus l'objet est loin. Cet indice est purement géométrique et, combiné à la hauteur de la caméra, il donne une profondeur *métrique*. C'est la base de [GroCo](/fr/papers/groco/). Les **ombres portées** révèlent la disposition des objets entre eux et par rapport à la lumière.

<figure class="small" style="--w:330px">
  <img src="/figures/learn/cue_atmosphere.webp" alt="Des montagnes de plus en plus brumeuses et bleutées avec la distance" loading="lazy">
  <figcaption>Perspective atmosphérique : les montagnes lointaines sont plus brumeuses et plus bleues.</figcaption>
</figure>

**Perspective atmosphérique.** Les objets lointains paraissent plus voilés, moins saturés et plus bleus, car la lumière diffuse dans l'air. Utile en paysage, peu fiable ailleurs.

Tous ces indices doivent être appris implicitement par un réseau. Et une ambiguïté ne disparaît jamais : sans information supplémentaire, la photo d'une maquette ressemble à celle de la vraie scène. C'est l'**ambiguïté d'échelle**, qui revient dans chaque chapitre de la thèse.

## La caméra sténopé

Pour passer des pixels aux points 3D, il faut un modèle de caméra. Le modèle standard est le **sténopé** : la lumière de chaque point de la scène passe par un minuscule trou et frappe le capteur, comme la lumière passe par la pupille jusqu'à la rétine.

<figure class="diagram">
  <img src="/figures/learn/pinhole_camera.svg" alt="Caméra sténopé comparée à l'œil humain" loading="lazy">
  <figcaption>Les rayons passent par le sténopé (ou la pupille) et forment une image inversée sur le capteur (ou la rétine).</figcaption>
</figure>

Les vraies caméras ont des objectifs, mais pour des champs de vue usuels, un sténopé avec la bonne focale est une bonne approximation. Les grands angles et les fisheyes courbent les rayons et nécessitent d'abord un modèle de distorsion.

### Paramètres intrinsèques

La caméra est décrite par sa **focale** $f$ (en pixels) et son **point principal** $(c_x, c_y)$, là où l'axe optique rencontre le capteur. Ils forment la matrice intrinsèque :

$$
K = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}.
$$

Un point 3D $P = (X, Y, Z)$ dans le repère caméra se projette sur le pixel $(u, v)$ par

$$
Z \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = K \begin{bmatrix} X \\ Y \\ Z \end{bmatrix}
\quad\Longleftrightarrow\quad
u = f_x \frac{X}{Z} + c_x, \qquad v = f_y \frac{Y}{Z} + c_y .
$$

Tout dépend des rapports $X/Z$ et $Y/Z$ : c'est cette division par la profondeur qui aplatit le monde. On le voit mieux sur le *plan image normalisé*, un plan virtuel à $Z = 1$ devant la caméra.

<figure class="diagram">
  <img src="/figures/learn/normalized_plane.svg" alt="Le plan image normalisé à Z égal 1" loading="lazy">
  <figcaption>Le plan normalisé : un point se projette en (X/Z, Y/Z, 1), puis K le met à l'échelle et le décale en pixels.</figcaption>
</figure>

Conséquence directe : un objet de largeur $W$ à la distance $Z$ apparaît large de $w = f_x W / Z$ pixels. Distance doublée, taille divisée par deux : c'est l'indice de taille relative écrit en équation.

<figure class="small" style="--w:360px">
  <img src="/figures/learn/perspective.webp" alt="Des objets identiques de plus en plus petits avec la profondeur" loading="lazy">
  <figcaption>Des objets identiques à des profondeurs croissantes rapetissent proportionnellement.</figcaption>
</figure>

### Profondeur ou distance ?

« Profondeur » peut désigner deux choses. En coordonnées cartésiennes, c'est $Z$, la distance le long de l'axe optique. En coordonnées sphériques, c'est la portée $\rho = \sqrt{X^2+Y^2+Z^2}$, la distance en ligne droite jusqu'à la caméra. Pour des caméras usuelles, $Z$ est la norme ; pour les fisheyes, où les points en bord d'image ont $Z \approx 0$, la portée est plus naturelle.

<figure class="diagram">
  <img src="/figures/learn/cartesian_vs_spherical.svg" alt="Profondeur cartésienne Z et portée sphérique rho" loading="lazy">
  <figcaption>Profondeur cartésienne <i>Z</i> et portée sphérique <i>ρ</i>.</figcaption>
</figure>

### Paramètres extrinsèques et repères

La caméra a aussi une position et une orientation : une rotation $R$ et une translation $t$ qui envoient un point du repère monde (ou véhicule) vers le repère caméra, $P_c = R P_w + t$. Avec $K$, on obtient la projection complète

$$
Z \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = K\,[R \mid t] \begin{bmatrix} X_w \\ Y_w \\ Z_w \\ 1 \end{bmatrix}.
$$

<figure class="diagram">
  <img src="/figures/learn/coordinate_frames.svg" alt="Repères véhicule, caméra et image sur une voiture" loading="lazy">
  <figcaption>Le repère véhicule, le repère caméra (Z vers l'avant, X à droite, Y vers le bas) et le repère image (origine en haut à gauche).</figcaption>
</figure>

### De la carte de profondeur au nuage de points

Inverser la projection donne le nuage de points : chaque pixel, multiplié par sa profondeur le long de son rayon,

$$
P_{u,v} = \mathcal{Z}_{u,v}\; K^{-1} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix}.
$$

On y ajoute la couleur du pixel pour obtenir les nuages colorés montrés plus haut.

## Comment sont construits les réseaux de profondeur

Presque tous les réseaux de profondeur sont des **encodeurs–décodeurs**. L'encodeur, souvent pré-entraîné sur ImageNet (ResNet, ConvNeXt ou ViT), transforme l'image en caractéristiques de plus en plus abstraites et de plus en plus basse résolution. Le décodeur les remonte à pleine résolution, avec des connexions de saut qui ramènent les détails fins des premières couches. Les décodeurs de type U-Net, comme dans Monodepth2 et HR-Depth, sont le choix courant en auto-supervision.

Deux choix de sortie comptent plus qu'il n'y paraît :

- **Quoi prédire.** Une régression simple donne une valeur par pixel. Une classification sur des intervalles de profondeur (comme DORN ou AdaBins) donne une distribution, qui peut exprimer une ambiguïté. Mon [article BMVC](/fr/papers/sob/) se situe entre les deux : un mélange à deux composantes par pixel.
- **Dans quel espace.** La profondeur brute traite toutes les distances de la même façon. La **disparité** (inverse de la profondeur) est linéaire en décalage de pixels entre vues, rend les plans linéaires et donne plus de résolution près de la caméra : c'est pourquoi la plupart des méthodes auto-supervisées l'utilisent. La log-profondeur convient aux scènes à très grande plage de distances.

## Comment la profondeur est évaluée

Les métriques standard comparent la profondeur prédite $\hat z_i$ à la vérité terrain LiDAR $z_i$ sur les pixels valides :

| Métrique | Formule | Remarques |
|---|---|---|
| AbsRel | $\frac{1}{N}\sum \lvert\hat z_i - z_i\rvert / z_i$ | erreur relative, insiste sur le proche |
| SqRel | $\frac{1}{N}\sum (\hat z_i - z_i)^2 / z_i^2$ | pénalise les grosses erreurs |
| RMSE | $\sqrt{\frac{1}{N}\sum (\hat z_i - z_i)^2}$ | en mètres |
| RMSE log | $\sqrt{\frac{1}{N}\sum (\log\hat z_i - \log z_i)^2}$ | moins sensible au lointain |
| δ < 1.25ᵏ | part des pixels où $\max(\hat z/z,\ z/\hat z) < 1.25^k$ | précision, robuste aux aberrations |

Les modèles auto-supervisés sont généralement évalués après **mise à l'échelle par la médiane** : chaque prédiction est recalée pour que sa médiane corresponde à la vérité terrain, ce qui masque l'ambiguïté d'échelle. Les méthodes métriques comme GroCo sont évaluées sans ce recalage, ce qui est plus difficile.

Quand la profondeur sert à construire des cartes 3D, les métriques sur nuage de points sont plus parlantes : **distance de Chamfer** (distance moyenne au plus proche voisin dans les deux sens), **F-score** ou **IoU** à un seuil de distance. Elles sanctionnent les points flottants aux bords des objets, que les métriques image remarquent à peine.

## Capteurs et jeux de données

La vérité terrain vient de capteurs de profondeur : **LiDAR** (précis, longue portée, mais clairsemé), **caméras stéréo** (dense, mais la précision chute avec la distance), **temps de vol** et **lumière structurée** (denses, surtout en intérieur). Les jeux de données utilisés dans la thèse sont **KITTI** (voitures à Karlsruhe, stéréo et LiDAR), **VKITTI2** (copie synthétique de KITTI avec une profondeur parfaite), **DDAD** (six caméras et un LiDAR longue portée, utile pour tester de nouveaux points de vue) et **NYUv2** (scènes d'intérieur).

Suite : [comment un réseau peut apprendre la profondeur à partir de vidéo seule](/fr/learn/multi-view/).
