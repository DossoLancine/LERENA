# Guide du matériel Lerena

Lerena fonctionne dans un navigateur : pas d’application à installer sur les écrans ni sur les bornes. Ce guide donne les **critères** à respecter ; les références précises sont à valider sur le terrain pendant le pilote (P15) puis à reporter ici.

## 1. Écran d’appel (salle d’attente)

| Option | Quand la choisir | Critères |
|---|---|---|
| **TV Android / Google TV** | Nouvelle installation | 43" minimum (55" pour une grande salle), navigateur Chrome ou « TV Bro », Wi-Fi 5 GHz ou câble réseau |
| **TV existante + boîtier Android** (catalogue : « Boîtier Android TV ») | La salle a déjà une TV | Entrée HDMI, boîtier Android 10+ avec 2 Go de mémoire |
| **TV + mini-PC ou ordinateur** | Réseau d’entreprise, TV non connectée | Câble HDMI ; Chrome en plein écran (F11) |

Réglages : désactiver la mise en veille de la TV, régler le son (annonces vocales), ouvrir l’adresse d’installation donnée dans **Paramètres → Appareils**, choisir « Écran ». L’écran se reconnecte seul après une coupure et se met à jour après chaque nouvelle version.

## 2. Borne de tickets (entrée)

| Élément | Critères |
|---|---|
| **Tablette** | Android 10 pouces, 3 Go de mémoire ou plus, Chrome à jour ; support mural ou sur pied **antivol** |
| **Imprimante (facultative)** | Thermique **80 mm**, compatible ESC/POS, USB ou Bluetooth ; rouleaux de 80 mm × 80 m |
| **Alimentation** | Prise proche ; onduleur conseillé là où le courant est instable |

### Impression sans fenêtre de confirmation

- **Tablette Android** : installer un service d’impression qui gère les imprimantes thermiques (par exemple RawBT), puis le choisir comme imprimante par défaut. Le ticket s’imprime à chaque prise de ticket ; le bouton « Réimprimer le ticket » relance l’impression si le papier a manqué.
- **Mini-PC Windows** : lancer Chrome en mode borne avec impression silencieuse :
  `chrome.exe --kiosk --kiosk-printing https://<domaine>/kiosk`

Sans imprimante, la borne affiche le numéro et un QR code à photographier ; le visiteur peut aussi suivre son ticket sur son téléphone.

## 3. Postes de l’équipe

| Poste | Matériel |
|---|---|
| Guichet (agent) | Ordinateur, tablette ou téléphone avec navigateur à jour |
| Accueil | Ordinateur ou tablette ; imprimante 80 mm facultative pour les tickets remis en main propre |
| Responsable | Ordinateur ou téléphone |

## 4. Réseau

- Débit modeste suffisant (les écrans échangent quelques kilo-octets) ; **stabilité** plus importante que vitesse.
- Box 4G de secours conseillée pour les sites où la connexion fixe coupe souvent.
- En cas de coupure : la borne affiche « Réseau indisponible : adressez-vous à l’accueil », puis reprend seule au retour du réseau.

## 5. Kit de démarrage type (1 site)

| Élément | Quantité |
|---|---|
| TV 43" + support mural (ou boîtier pour TV existante) | 1 par salle d’attente |
| Tablette borne + support antivol | 1 par entrée |
| Imprimante thermique 80 mm + 10 rouleaux | 1 par borne (facultatif) |
| Affiche QR code imprimée (Paramètres → Affiche) | 2 à 3 |

Le matériel est proposé à la vente ou à la location dans la boutique (Abonnement), avec l’installation et la formation sur place.
