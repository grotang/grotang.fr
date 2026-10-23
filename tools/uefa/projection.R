# ============================================================================
#  PROJECTION DU COEFFICIENT UEFA PAR ASSOCIATION  -  MONTE-CARLO
#  Replique du modele de grotang.fr, bloc 8 (moteur "calendrier", 23/10/2026).
#
#  ENCODAGE : ce fichier est en ASCII pur, sans aucun caractere accentue,
#  pour s'ouvrir a l'identique en CP1252, en UTF-8 et dans R quel que soit
#  le locale. Merci de ne pas remettre d'accents ici.
#
#  Aucune dependance : R de base uniquement.
#  Usage :  Rscript projection.R            (parametres ci-dessous)
#           Rscript projection.R --sigma 0.30 --nsim 5000
#
#  Ancienne version (adversaire moyen, classement retire au sort depuis zero) :
#  tools/uefa/_old/projection.R
# ============================================================================


# GT comm : pour update les json sur notre PC, depuis GitHub (la ou est la source)
# Lignes de commandes dans terminal powershell:
# cd "C:\Users\tangu\Documents\Claude\2026.09 grotang.fr\grotang.fr"
# git pull


# ----------------------------- CE QUI A CHANGE -------------------------------
# 1. Les VRAIES affiches de la phase de ligue (fichier wiki/affiches-AAAA-AA.json,
#    releve par le robot sur Wikipedia) : Juventus - Rennes se joue a Turin,
#    Italie contre France, avec l'avantage du terrain (HOME).
# 2. Le classement de la phase de ligue part des points REELS de chaque club
#    (bareme UEFA 3/1/0), auxquels s'ajoutent les seules affiches restantes.
#    Un meme tirage sert au classement ET au coefficient.
# 3. Plus de parametre JOUEES a tenir a la main : les matchs joues se lisent
#    club par club dans le fichier des affiches (un match avec un score est joue).
# 4. PNUL passe de 0.24 a 0.20 (taux de nuls de l'archive).
# 5. En sortie, en plus des nations : les probabilites de classement en phase
#    de ligue pour les clubs du pays choisi (CLUBS_PAYS).
# 6. Phase finale : le vrai tableau UEFA, fixe par le classement (avant : duels
#    tires au hasard), et la forme de la saison compte aussi dans les duels.


# ----------------------------- PARAMETRES -----------------------------------

P <- list(

  NSIM    = 1000,  # Volume de saisons simulees.
                    # 20000 si on veut lire le 99.75e centile sans bruit.

  SIGMA   = 0.12,   # CHOC DE FORME DE LA NATION DE TETE. Tire une fois par
                    # nation et par saison simulee, ajoute a la force de TOUS
                    # ses clubs. C'est ce qui ouvre les queues : le coefficient
                    # divise par les clubs engages, donc avec des tirages
                    # independants la variance de cette moyenne est divisee par
                    # la racine du nombre de clubs. SIGMA = 0 : modele d'origine.

  LAMBDA  = 1.0,    # Le choc n'est pas le meme pour tous. Observe sur l'archive :
                    # Espagne 0.08 de variation d'une saison a l'autre, Angleterre
                    # 0.12, mais Grece 0.44 et Chypre 0.42.
                    #    sigma(n) = SIGMA * (coef de la tete / coef de n) ^ LAMBDA
                    # LAMBDA = 1 : inversement proportionnel au coefficient.
                    # LAMBDA = 0 : un choc unique pour tous.

  SCAP    = 0.45,   # plafond du choc. Garde-fou pour les micro-nations ; a
                    # LAMBDA = 1 il ne mord pour aucune des 16 nations calibrees.

  DELTA   = 0.11,   # ECART DE RANG DANS LE CONTINGENT. Deux clubs voisins de la
                    # meme nation different de DELTA en force. L'ordre est C1,
                    # puis C3, puis C4 : le meilleur proxy du rang domestique
                    # dont on dispose. Centre, donc la force moyenne de la
                    # nation ne bouge pas. DELTA = 0 : tous les clubs d'un pays
                    # sont identiques.

  BETA    = 1.10,   # POIDS DE L'ECART DE FORCE dans un match de phase de ligue.
                    # La force d'une nation = log de son coefficient a 5 ans.
                    # Hors nuls, chance de gagner = sig(BETA x ecart de force + HOME).
                    # BETA = 0 : tout le monde se vaut ; plus BETA est grand,
                    # plus le favori gagne souvent.
  GAMMA   = 0.70,   # idem pour un duel de phase finale
  PNUL    = 0.20,   # taux de nul, identique pour tout le monde (archive : 20.1 %)
  HOME    = 0.57,   # AVANTAGE DU TERRAIN, phase de ligue. Archive 2021-2026, 1656
                    # matchs : domicile 49.2 %, nul 20.1 %, exterieur 30.7 %.
                    # Hors nuls, le club qui recoit gagne 61.5 % : HOME ~ 0.54-0.58
                    # retrouve ce taux ; 0.57 retenu (GT, 23/10/2026). HOME = 0 : neutre.
  KPSEUDO = 56,     # la saison en cours pese w = m/(m+KPSEUDO) dans la force.
                    # Cale pour valoir la moitie en fin de phase de ligue.

  GRAINE  = NA,                # NA : une graine differente a chaque lancer, donc
                               # une vraie nouvelle simulation a chaque fois.
                               # La graine tiree est affichee, donc un resultat
                               # qui intrigue reste reproductible : recopie-la
                               # ici a la place de NA.
                               # Ce script est un bac a sable, il DOIT varier.
                               # Le site, lui, est fige sur la date des donnees :
                               # deux visiteurs du meme jour doivent voir les
                               # memes chiffres. Les deux regles sont opposees,
                               # et c'est normal - ce sont deux usages opposes.
  # Chemin du fichier de donnees, sorti par l'extracteur. C'est un fichier
  # LOCAL, sur ce PC : rien n'est telecharge, rien ne va chercher sur GitHub.
  # Si tu deplaces le depot, c'est la seule ligne a changer.
  # (Barres obliques normales, pas d'antislash : R les prefere sous Windows.)
  # Les affiches sont lues a cote : wiki/affiches-2026-27.json.
  FICHIER = "C:/Users/tangu/Documents/Claude/2026.09 grotang.fr/grotang.fr/tools/uefa/nations.json",
  SAISON  = "2026",            # cle de la saison dans le fichier des affiches
  SORTIE  = "projection_uefa.csv",
  FOCUS   = c("ENG","ESP","ITA","GER","FRA","POR","NED","BEL","DEN"),
  CLUBS_PAYS = "FRA"           # probabilites de classement : les clubs de ce pays
)

# bareme fixe, pas des parametres : ce sont les regles UEFA 2024/25
JTOT  <- c(8, 8, 6)        # journees de phase de ligue par competition
KOBON <- c(1.5, 1, 0.5)    # bonus par tour de phase finale atteint
KNOM  <- c("C1", "C3", "C4")

arg <- commandArgs(TRUE)
if (length(arg) >= 2) for (i in seq(1, length(arg) - 1, by = 2)) {
  k <- toupper(sub("^--", "", arg[i])); if (!is.null(P[[k]])) P[[k]] <- as.numeric(arg[i + 1])
}

# --------------------------- LECTURE DES DONNEES ----------------------------
# Lecteur JSON minimal : jsonlite n'est pas garanti present, et les fichiers ont
# une forme connue et stable. On extrait ce dont on a besoin, rien de plus.

# Filet de secours, au cas ou le chemin ci-dessus ne serait plus bon : on
# regarde a cote du script, puis dans le repertoire de travail. Tout est local.
trouver_fichier <- function(nom) {
  if (file.exists(nom)) return(normalizePath(nom, winslash = "/"))
  pistes <- nom

  a <- commandArgs(FALSE)                       # lance par Rscript
  f <- a[grep("^--file=", a)]
  if (length(f)) pistes <- c(pistes, file.path(dirname(sub("^--file=", "", f[1])), basename(nom)))
  of <- tryCatch(sys.frames()[[1]]$ofile, error = function(e) NULL)   # source()
  if (!is.null(of)) pistes <- c(pistes, file.path(dirname(normalizePath(of)), basename(nom)))

  d <- normalizePath(getwd(), winslash = "/")   # remontee depuis le courant
  for (i in 1:8) {
    pistes <- c(pistes, file.path(d, basename(nom)),
                        file.path(d, "tools", "uefa", basename(nom)))
    parent <- dirname(d); if (parent == d) break; d <- parent
  }

  pistes <- unique(pistes)
  for (pp in pistes) if (file.exists(pp)) return(normalizePath(pp, winslash = "/"))

  stop(paste0(
    "\n  Fichier de donnees introuvable : ", nom,
    "\n\n  Corrige la ligne FICHIER en tete de ce script : mets-y le chemin",
    "\n  complet de nations.json sur ce PC, avec des barres obliques normales.",
    "\n  Exemple : C:/Users/.../grotang.fr/tools/uefa/nations.json\n"),
    call. = FALSE)
}

lire_nations <- function(chemin) {
  chemin <- trouver_fichier(chemin)
  cat(sprintf("lecture de %s\n", chemin))
  txt <- paste(readLines(chemin, warn = FALSE, encoding = "UTF-8"), collapse = "")
  blocs <- regmatches(txt, gregexpr("\\{[^{}]*\\}", txt))[[1]]
  champ_n <- function(b, nom) {
    m <- regmatches(b, regexpr(paste0('"', nom, '"\\s*:\\s*-?[0-9.]+'), b))
    if (!length(m)) return(NA_real_)
    as.numeric(sub(".*:\\s*", "", m))
  }
  champ_s <- function(b, nom) {
    m <- regmatches(b, regexpr(paste0('"', nom, '"\\s*:\\s*"[^"]*"'), b))
    if (!length(m)) return(NA_character_)
    gsub('.*:\\s*"|"$', "", m)
  }
  champ_v <- function(b, nom) {
    m <- regmatches(b, regexpr(paste0('"', nom, '"\\s*:\\s*\\[[^]]*\\]'), b))
    if (!length(m)) return(numeric(0))
    as.numeric(strsplit(gsub(".*\\[|\\]", "", m), ",")[[1]])
  }
  out <- list()
  for (b in blocs) {
    c3 <- champ_s(b, "c"); if (is.na(c3) || nchar(c3) != 3) next
    a <- champ_v(b, "a"); if (length(a) < 4) next
    out[[length(out) + 1]] <- list(
      c = c3, t = champ_n(b, "t"), tp = champ_n(b, "tp"),
      lp = champ_n(b, "lp"), div = champ_n(b, "divisor"),
      a = a[1:3])
  }
  out
}

# Les affiches : [competition (0/1/2), journee, "date", "heure", "domicile",
# "NAT", "exterieur", "NAT", buts dom | null, buts ext | null]. On ne garde que
# la phase de ligue (journee numerique). Un match avec un score est joue.
lire_affiches <- function(chemin_nations, saison) {
  d <- dirname(trouver_fichier(chemin_nations))
  fic <- list.files(file.path(d, "wiki"), pattern = paste0("^affiches-", saison, "-[0-9]{2}\\.json$"), full.names = TRUE)
  if (!length(fic)) stop(sprintf("\n  Affiches introuvables : %s/wiki/affiches-%s-AA.json\n", d, saison), call. = FALSE)
  cat(sprintf("lecture de %s\n", fic[1]))
  txt <- paste(readLines(fic[1], warn = FALSE, encoding = "UTF-8"), collapse = "")
  re <- '\\[([0-9]+),([0-9]+),"([0-9-]+)","([^"]*)","([^"]*)","([A-Z]{3})","([^"]*)","([A-Z]{3})",(null|[0-9]+),(null|[0-9]+)\\]'
  m <- regmatches(txt, gregexpr(re, txt))[[1]]
  if (!length(m)) stop("\n  Aucune affiche de phase de ligue lue.\n", call. = FALSE)
  x <- do.call(rbind, lapply(m, function(s) regmatches(s, regexec(re, s))[[1]][-1]))
  num <- function(v) suppressWarnings(as.numeric(ifelse(v == "null", NA, v)))
  data.frame(k = as.integer(x[, 1]) + 1, j = as.integer(x[, 2]) + 1, date = x[, 3], heure = x[, 4],
             dom = x[, 5], cd = x[, 6], ext = x[, 7], ce = x[, 8],
             bd = num(x[, 9]), be = num(x[, 10]), stringsAsFactors = FALSE)
}

# ------------------------------- MODELE -------------------------------------

sig <- function(x) 1 / (1 + exp(-x))

bonus_rang <- function(k, r) {
  if (r > 24) return(0)
  if (k == 3) { if (r >= 9) 0.125 * (25 - r) else 2 + 0.25 * (9 - r) } else 0.25 * (25 - r)
}

# Chaque competition : ses 36 clubs, leur nation, leurs points reels (3/1/0),
# leurs matchs joues, et les affiches restantes (sans score).
preparer <- function(AF, eff) {
  lapply(1:3, function(k) {
    a <- AF[AF$k == k, ]
    if (nrow(a) != 18 * JTOT[k]) stop(sprintf("\n  %s : %d affiches au lieu de %d.\n", KNOM[k], nrow(a), 18 * JTOT[k]), call. = FALSE)
    clubs <- unique(c(rbind(a$dom, a$ext)))
    nat   <- setNames(c(a$cd, a$ce), c(a$dom, a$ext))[clubs]
    if (length(clubs) != 36) stop(sprintf("\n  %s : %d clubs au lieu de 36.\n", KNOM[k], length(clubs)), call. = FALSE)
    cnt <- table(nat)
    for (cc in names(cnt)) if (!(cc %in% rownames(eff)) || eff[cc, k] != cnt[[cc]])
      stop(sprintf("\n  %s : %d club(s) %s dans les affiches, pas le meme nombre dans nations.json.\n", KNOM[k], cnt[[cc]], cc), call. = FALSE)
    joue <- !is.na(a$bd)
    h <- match(a$dom, clubs); e <- match(a$ext, clubs)
    pd <- ifelse(a$bd > a$be, 3, ifelse(a$bd == a$be, 1, 0))      # points du classement, matchs joues
    pe <- ifelse(a$be > a$bd, 3, ifelse(a$bd == a$be, 1, 0))
    reel <- tabulate(rep(h[joue], pd[joue]), 36) + tabulate(rep(e[joue], pe[joue]), 36)
    mj   <- tabulate(h[joue], 36) + tabulate(e[joue], 36)
    list(clubs = clubs, nat = unname(nat), reel = reel, mj = mj,
         h = h[!joue], e = e[!joue])
  })
}

simuler <- function(NA_, AF, P) {
  gr <- if (is.na(P$GRAINE)) sample.int(.Machine$integer.max, 1) else P$GRAINE
  cat(sprintf("graine %d\n", gr))
  set.seed(gr)
  code <- sapply(NA_, `[[`, "c")
  tt   <- sapply(NA_, `[[`, "t")
  tp   <- sapply(NA_, `[[`, "tp")
  lp   <- sapply(NA_, `[[`, "lp");  lp[is.na(lp)] <- 0
  dv   <- sapply(NA_, `[[`, "div"); dv[is.na(dv) | dv == 0] <- NA
  eff  <- t(sapply(NA_, `[[`, "a"))            # clubs par competition
  names(tt) <- names(tp) <- names(lp) <- names(dv) <- code
  rownames(eff) <- code

  C <- preparer(AF, eff)
  for (k in 1:3) cat(sprintf("%s : %d matchs joues, %d a jouer\n", KNOM[k], sum(C[[k]]$mj) / 2, length(C[[k]]$h)))

  # force de base : nation + ecart de rang dans le contingent (C1, C3, C4), centre
  tot <- rowSums(eff)
  j   <- setNames(rep(0, length(code)), code)
  F0  <- lapply(1:3, function(k) numeric(36))
  for (k in 1:3) for (i in 1:36) {
    cc <- C[[k]]$nat[i]
    F0[[k]][i] <- log(tt[cc]) + P$DELTA * ((tot[cc] - 1) / 2 - j[cc])
    j[cc] <- j[cc] + 1
  }

  # rendement observe cette saison (points de phase de ligue par match) et son poids
  m_nat <- setNames(rep(0, length(code)), code)
  for (k in 1:3) { s <- tapply(C[[k]]$mj, C[[k]]$nat, sum); m_nat[names(s)] <- m_nat[names(s)] + s }
  obs_n <- ifelse(m_nat > 0, lp / pmax(m_nat, 1), 0)
  w_nat <- ifelse(m_nat > 0, m_nat / (m_nat + P$KPSEUDO), 0)

  # choc propre a chaque nation, indexe sur son niveau
  sigma_n <- pmin(P$SCAP, P$SIGMA * (max(tt[!is.na(dv)]) / pmax(1, tt)) ^ P$LAMBDA)
  names(sigma_n) <- code

  vivants <- code[!is.na(dv)]
  res <- matrix(0, nrow = P$NSIM, ncol = length(vivants), dimnames = list(NULL, vivants))
  ctrl <- c(ko = 0, part = 0, rang = 0)
  # probabilites de classement : les clubs du pays CLUBS_PAYS
  suivis <- lapply(1:3, function(k) which(C[[k]]$nat == P$CLUBS_PAYS))
  RANG <- lapply(1:3, function(k) matrix(0, nrow = length(suivis[[k]]), ncol = 36))
  PTSM <- lapply(1:3, function(k) numeric(length(suivis[[k]])))

  for (s in seq_len(P$NSIM)) {
    z <- setNames(sigma_n * rnorm(length(code)), code)
    gain <- setNames(rep(0, length(code)), code)

    for (k in 1:3) {
      Ck <- C[[k]]; cl <- Ck$nat; f <- F0[[k]] + z[cl]
      e  <- 2 * sig(P$BETA * (f - mean(f)))
      e  <- (1 - w_nat[cl]) * e + w_nat[cl] * obs_n[cl]
      e  <- e / mean(e)                       # conservation : 1 point par match
      pw <- pmax(0, (e - P$PNUL) / 2)
      # force effective face au champ, puis les vraies affiches restantes
      q  <- pmin(0.99, pmax(0.01, pw / (1 - P$PNUL)))
      se <- log(q / (1 - q)) / P$BETA

      pts <- Ck$reel
      if (length(Ck$h)) {
        ph <- (1 - P$PNUL) * sig(P$BETA * (se[Ck$h] - se[Ck$e]) + P$HOME)
        u  <- runif(length(ph))
        rh <- ifelse(u < ph, 2, ifelse(u < ph + P$PNUL, 1, 0)); re <- 2 - rh
        # classement : bareme 3 / 1 / 0
        pts <- pts + tabulate(rep(Ck$h, ifelse(rh == 2, 3, rh)), 36) + tabulate(rep(Ck$e, ifelse(re == 2, 3, re)), 36)
        # coefficient : 2 / 1 / 0
        g <- tapply(c(rh, re), c(cl[Ck$h], cl[Ck$e]), sum)
        gain[names(g)] <- gain[names(g)] + g
      }

      ord <- order(-pts, -f, runif(36))       # classement de la phase de ligue
      for (r in 1:36) { v <- bonus_rang(k, r)
        gain[cl[ord[r]]] <- gain[cl[ord[r]]] + v; ctrl["rang"] <- ctrl["rang"] + v }
      if (length(suivis[[k]])) { rg <- match(suivis[[k]], ord)
        RANG[[k]][cbind(seq_along(rg), rg)] <- RANG[[k]][cbind(seq_along(rg), rg)] + 1
        PTSM[[k]] <- PTSM[[k]] + pts[suivis[[k]]] }

      # Un duel de phase finale : les manches sont jouees, le qualifie est celui
      # qui a pris le plus de points (a egalite : prolongation / tirs au but,
      # penches vers le plus fort). Force : la force effective `se`, forme de la
      # saison comprise (avant le 23/10/2026 : le seul niveau de la nation).
      duel <- function(a, b, manches) {
        pa <- (1 - P$PNUL) * sig(P$GAMMA * (se[a] - se[b]))
        sa <- 0; sb <- 0
        for (g in seq_len(manches)) { u <- runif(1)
          if (u < pa) sa <- sa + 2 else if (u < pa + P$PNUL) { sa <- sa + 1; sb <- sb + 1 } else sb <- sb + 2 }
        gain[cl[a]] <<- gain[cl[a]] + sa; gain[cl[b]] <<- gain[cl[b]] + sb
        ctrl["ko"] <<- ctrl["ko"] + sa + sb
        if (sa > sb) a else if (sb > sa) b else if (runif(1) < sig(P$GAMMA * (se[a] - se[b]))) a else b
      }
      bonus <- function(L) for (i in L) { gain[cl[i]] <<- gain[cl[i]] + KOBON[k]; ctrl["part"] <<- ctrl["part"] + 1 }
      # LE TABLEAU UEFA (format 2024/25), fixe par le classement de la phase de ligue :
      #  barrages 9e-10e contre 23e-24e, 11e-12e / 21e-22e, 13e-14e / 19e-20e, 15e-16e / 17e-18e ;
      #  8es : tetes 1-2 contre le bloc 15e-18e, 3-4 / 13e-20e, 5-6 / 11e-22e, 7-8 / 9e-24e ;
      #  1er et 2e dans deux moities differentes (idem 3/4, 5/6, 7/8) ;
      #  quarts : tete 1-2 contre tete 7-8, tete 3-4 contre tete 5-6 ; puis demies, finale.
      deux  <- function(x, y) if (runif(1) < 0.5) c(x, y) else c(y, x)
      blocs <- list(c(9, 10, 23, 24), c(11, 12, 21, 22), c(13, 14, 19, 20), c(15, 16, 17, 18))
      qual  <- lapply(blocs, function(b) { u <- deux(ord[b[3]], ord[b[4]]); c(duel(ord[b[1]], u[1], 2), duel(ord[b[2]], u[2], 2)) })
      tetes <- list(c(1, 2, 4), c(3, 4, 3), c(5, 6, 2), c(7, 8, 1))   # deux tetes de serie, bloc de barragistes
      bonus(c(ord[1:8], unlist(qual)))                                 # les 16 clubs des 8es
      moitie <- list(integer(4), integer(4))
      for (ti in 1:4) {
        tdc <- tetes[[ti]]; w <- deux(qual[[tdc[3]]][1], qual[[tdc[3]]][2]); h <- if (runif(1) < 0.5) 1 else 2
        moitie[[h]][ti]     <- duel(ord[tdc[1]], w[1], 2)
        moitie[[3 - h]][ti] <- duel(ord[tdc[2]], w[2], 2)
      }
      fin <- integer(2)
      for (h in 1:2) {
        M <- moitie[[h]]; bonus(M)
        q1 <- duel(M[1], M[4], 2); q2 <- duel(M[2], M[3], 2)
        bonus(c(q1, q2)); fin[h] <- duel(q1, q2, 2)
      }
      bonus(fin); duel(fin[1], fin[2], 1)
    }
    res[s, ] <- (tp[vivants] + gain[vivants]) / dv[vivants]
  }
  clubs <- do.call(rbind, lapply(1:3, function(k) if (length(suivis[[k]])) {
    d <- data.frame(competition = KNOM[k], club = C[[k]]$clubs[suivis[[k]]], pts_actuels = C[[k]]$reel[suivis[[k]]],
                    pts_attendus = PTSM[[k]] / P$NSIM, stringsAsFactors = FALSE)
    cbind(d, setNames(as.data.frame(RANG[[k]] / P$NSIM), paste0("r", 1:36)))
  }))
  list(res = res, ctrl = ctrl / P$NSIM, clubs = clubs)
}

# -------------------------------- SORTIE ------------------------------------

NA_ <- lire_nations(P$FICHIER)
AF  <- lire_affiches(P$FICHIER, P$SAISON)
cat(sprintf("%d associations lues, %d affiches de phase de ligue\n", length(NA_), nrow(AF)))
cat(sprintf("sigma(tete) = %.2f   lambda = %.1f   delta = %.2f   beta = %.2f   gamma = %.2f   p(nul) = %.2f   home = %.2f   %d saisons\n\n",
            P$SIGMA, P$LAMBDA, P$DELTA, P$BETA, P$GAMMA, P$PNUL, P$HOME, P$NSIM))

S <- simuler(NA_, AF, P)
R <- S$res

qs <- c(0.05, 0.20, 0.50, 0.80, 0.95)
tab <- t(apply(R, 2, quantile, probs = qs, names = FALSE))
colnames(tab) <- c("p05", "p20", "med", "p80", "p95")

# Le 99.75e centile lu comme une seule statistique d'ordre est fragile : a 2000
# tirages c'est le sixieme meilleur, il varie de +-0.26 d'une graine a l'autre
# et il est biaise vers le bas, faute d'avoir tire de vraies saisons extremes.
# On moyenne une petite fenetre de rangs autour de la cible : meme grandeur
# estimee, variance divisee par la racine du nombre de rangs retenus.
haut <- function(x, p = 0.9975, large = 0.0015) {
  v <- sort(x); n <- length(v)
  c0 <- min(n, max(1, floor(p * n)))
  d  <- max(1, round(n * large))
  mean(v[max(1, c0 - d):min(n, c0 + d)])
}
tab <- cbind(tab, p9975 = apply(R, 2, haut))
tab <- as.data.frame(tab)
tab$nation <- rownames(tab)
tab$ecart  <- tab$p95 - tab$p05
tab <- tab[order(-tab$med), c("nation", "p05", "p20", "med", "p80", "p95", "p9975", "ecart")]

cat("\n--- SYNTHESE, nations suivies -------------------------------------------\n")
f <- tab[tab$nation %in% P$FOCUS, ]
print(format(f, digits = 3, nsmall = 2), row.names = FALSE)

cat("\n--- DISPERSION -----------------------------------------------------------\n")
cat(sprintf("etendue 5e-95e, mediane des nations suivies : %.2f point de coefficient\n", median(f$ecart)))
cat(sprintf("etendue 5e-95e, mediane des %d associations : %.2f\n", nrow(tab), median(tab$ecart)))
cat(sprintf("ecart-type entre nations (de leurs medianes) : %.2f\n", sd(tab$med)))

cat("\n--- DUELS, probabilite que la ligne finisse devant la colonne ------------\n")
duo <- P$FOCUS[P$FOCUS %in% colnames(R)]
M <- outer(duo, duo, Vectorize(function(a, b) if (a == b) NA else mean(R[, a] > R[, b])))
dimnames(M) <- list(duo, duo)
print(round(100 * M))

if (!is.null(S$clubs)) {
  cat(sprintf("\n--- CLASSEMENT DE PHASE DE LIGUE, clubs %s (en %%) ------------------------\n", P$CLUBS_PAYS))
  K <- S$clubs; rk <- as.matrix(K[, paste0("r", 1:36)])
  vue <- data.frame(comp = K$competition, club = K$club, pts = K$pts_actuels,
                    attendus = round(K$pts_attendus, 1),
                    top8 = round(100 * rowSums(rk[, 1:8, drop = FALSE]), 1),
                    barrages = round(100 * rowSums(rk[, 9:24, drop = FALSE]), 1),
                    elimine = round(100 * rowSums(rk[, 25:36, drop = FALSE]), 1))
  print(vue, row.names = FALSE)
}

# Attendus, par saison et pour les TROIS competitions cumulees :
#   phase finale   3 x 90  = 270 points  (45 matchs par competition, 2 points chacun)
#   participations 3 x 30  =  90         (16+8+4+2 clubs presents a un tour a bonus)
#   bonus de rang  75+75+42 = 192
cat("\n--- CONTROLES DE CONSERVATION (par saison, les 3 competitions) -----------\n")
verif <- function(lab, val, att) cat(sprintf("%-34s %8.1f   attendu %6.1f   %s\n",
  lab, val, att, if (abs(val - att) < 0.05) "ok" else "ECART"))
verif("points de phase finale distribues", S$ctrl["ko"],   270)
verif("participations a un tour a bonus",  S$ctrl["part"],  90)
verif("bonus de classement distribues",    S$ctrl["rang"], 192)

# La sortie va a cote de nations.json, pas dans le repertoire courant : lance
# depuis la console, celui-ci peut etre n'importe ou.
sortie <- file.path(dirname(trouver_fichier(P$FICHIER)), P$SORTIE)
write.csv(tab, sortie, row.names = FALSE)
cat(sprintf("\n%d lignes ecrites dans %s\n", nrow(tab), sortie))
if (!is.null(S$clubs)) {
  sortie2 <- sub("\\.csv$", paste0("_classement_", P$CLUBS_PAYS, ".csv"), sortie)
  write.csv(S$clubs, sortie2, row.names = FALSE)
  cat(sprintf("probabilites de classement ecrites dans %s\n", sortie2))
}
