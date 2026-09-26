# ============================================================================
#  PROJECTION DU COEFFICIENT UEFA PAR ASSOCIATION  -  MONTE-CARLO
#  Replique du modele de grotang.fr, bloc 8.
#
#  ENCODAGE : ce fichier est en ASCII pur, sans aucun caractere accentue,
#  pour s'ouvrir a l'identique en CP1252, en UTF-8 et dans R quel que soit
#  le locale. Merci de ne pas remettre d'accents ici.
#
#  Aucune dependance : R de base uniquement.
#  Usage :  Rscript projection.R            (parametres ci-dessous)
#           Rscript projection.R --sigma 0.30 --nsim 5000
# ============================================================================

# ----------------------------- PARAMETRES -----------------------------------

P <- list(

  NSIM    = 4000,   # saisons simulees. 4000 suffit pour la mediane ; monter a
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

  BETA    = 1.15,   # pente logistique en phase de ligue
  GAMMA   = 1.10,   # pente logistique en duel de phase finale
  PNUL    = 0.24,   # taux de nul, identique pour tout le monde
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
  FICHIER = "C:/Users/tangu/Documents/Claude/2026.09 grotang.fr/grotang.fr/tools/uefa/nations.json",
  JOUEES  = c(1, 1, 0),        # journees de phase de ligue deja disputees, C1/C3/C4
  SORTIE  = "projection_uefa.csv",
  FOCUS   = c("ENG","ESP","ITA","GER","FRA","POR","NED","BEL","DEN")
)

# bareme fixe, pas des parametres : ce sont les regles UEFA 2024/25
JTOT  <- c(8, 8, 6)        # journees de phase de ligue par competition
KOBON <- c(1.5, 1, 0.5)    # bonus par tour de phase finale atteint

arg <- commandArgs(TRUE)
if (length(arg) >= 2) for (i in seq(1, length(arg) - 1, by = 2)) {
  k <- toupper(sub("^--", "", arg[i])); if (!is.null(P[[k]])) P[[k]] <- as.numeric(arg[i + 1])
}

# --------------------------- LECTURE DES DONNEES ----------------------------
# Lecteur JSON minimal : jsonlite n'est pas garanti present, et le fichier a
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
  txt <- paste(readLines(chemin, warn = FALSE), collapse = "")
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

# ------------------------------- MODELE -------------------------------------

sig <- function(x) 1 / (1 + exp(-x))

bonus_rang <- function(k, r) {
  if (r > 24) return(0)
  if (k == 3) { if (r >= 9) 0.125 * (25 - r) else 2 + 0.25 * (9 - r) } else 0.25 * (25 - r)
}

simuler <- function(NA_, P) {
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

  # plateau de chaque competition : un vecteur de codes nation, 36 par competition
  CH <- lapply(1:3, function(k) rep(code, times = eff[, k]))
  stopifnot(all(sapply(CH, length) == 36))

  # force de base : nation + ecart de rang dans le contingent, centre
  tot <- rowSums(eff)
  j   <- setNames(rep(0, length(code)), code)
  F0  <- lapply(1:3, function(k) numeric(36))
  for (k in 1:3) for (i in seq_along(CH[[k]])) {
    cc <- CH[[k]][i]
    F0[[k]][i] <- log(tt[cc]) + P$DELTA * ((tot[cc] - 1) / 2 - j[cc])
    j[cc] <- j[cc] + 1
  }

  # rendement observe cette saison, et son poids : hors de la boucle
  m_nat <- as.vector(eff %*% P$JOUEES); names(m_nat) <- code
  obs_n <- ifelse(m_nat > 0, lp / pmax(m_nat, 1), 0)
  w_nat <- ifelse(m_nat > 0, m_nat / (m_nat + P$KPSEUDO), 0)
  OBS <- lapply(1:3, function(k) obs_n[CH[[k]]])
  WPO <- lapply(1:3, function(k) w_nat[CH[[k]]])

  # choc propre a chaque nation, indexe sur son niveau
  sigma_n <- pmin(P$SCAP, P$SIGMA * (max(tt[!is.na(dv)]) / pmax(1, tt)) ^ P$LAMBDA)
  names(sigma_n) <- code

  vivants <- code[!is.na(dv)]
  res <- matrix(0, nrow = P$NSIM, ncol = length(vivants), dimnames = list(NULL, vivants))
  ctrl <- c(ko = 0, part = 0, rang = 0)

  for (s in seq_len(P$NSIM)) {
    z <- setNames(sigma_n * rnorm(length(code)), code)
    gain <- setNames(rep(0, length(code)), code)

    for (k in 1:3) {
      cl <- CH[[k]]; f <- F0[[k]] + z[cl]
      e  <- 2 * sig(P$BETA * (f - mean(f)))
      e  <- (1 - WPO[[k]]) * e + WPO[[k]] * OBS[[k]]
      e  <- e / mean(e)                       # conservation : 1 point par match
      pw <- pmax(0, (e - P$PNUL) / 2)

      tire <- function(n) {                   # n matchs par club, points marques
        u <- matrix(runif(36 * n), nrow = 36)
        rowSums((u < pw) * 2 + (u >= pw & u < pw + P$PNUL) * 1)
      }
      pts   <- tire(JTOT[k])                  # saison complete : sert a classer
      reste <- JTOT[k] - P$JOUEES[k]
      if (reste > 0) { g <- tire(reste)
        for (i in 1:36) gain[cl[i]] <- gain[cl[i]] + g[i] }

      ord <- order(-pts, -f, runif(36))       # classement de la phase de ligue
      for (r in 1:36) { v <- bonus_rang(k, r)
        gain[cl[ord[r]]] <- gain[cl[ord[r]]] + v; ctrl["rang"] <- ctrl["rang"] + v }

      duel <- function(pool, manches) {       # un tour : les manches sont jouees
        p <- sample(pool); out <- integer(0)
        for (i in seq(1, length(p), by = 2)) {
          a <- p[i]; b <- p[i + 1]
          pa <- (1 - P$PNUL) * sig(P$GAMMA * (f[a] - f[b]))
          sa <- 0; sb <- 0
          for (g in seq_len(manches)) { u <- runif(1)
            if (u < pa) sa <- sa + 2 else if (u < pa + P$PNUL) { sa <- sa + 1; sb <- sb + 1 } else sb <- sb + 2 }
          gain[cl[a]] <<- gain[cl[a]] + sa; gain[cl[b]] <<- gain[cl[b]] + sb
          ctrl["ko"] <<- ctrl["ko"] + sa + sb
          out <- c(out, if (sa > sb) a else if (sb > sa) b else if (runif(1) < 0.5) a else b)
        }
        out
      }
      lot <- c(ord[1:8], duel(ord[9:24], 2))  # barrages : aucun bonus de tour
      for (t in 1:4) {                        # 8es, quarts, demies, finale
        for (i in lot) { gain[cl[i]] <- gain[cl[i]] + KOBON[k]; ctrl["part"] <- ctrl["part"] + 1 }
        lot <- duel(lot, if (t == 4) 1 else 2)
      }
    }
    res[s, ] <- (tp[vivants] + gain[vivants]) / dv[vivants]
  }
  list(res = res, ctrl = ctrl / P$NSIM)
}

# -------------------------------- SORTIE ------------------------------------

NA_ <- lire_nations(P$FICHIER)
cat(sprintf("%d associations lues\n", length(NA_)))
cat(sprintf("sigma(tete) = %.2f   lambda = %.1f   delta = %.2f   beta = %.2f   gamma = %.2f   p(nul) = %.2f   %d saisons\n\n",
            P$SIGMA, P$LAMBDA, P$DELTA, P$BETA, P$GAMMA, P$PNUL, P$NSIM))

S <- simuler(NA_, P)
R <- S$res

qs <- c(0.05, 0.20, 0.50, 0.80, 0.95, 0.9975)
tab <- t(apply(R, 2, quantile, probs = qs, names = FALSE))
colnames(tab) <- c("p05", "p20", "med", "p80", "p95", "p9975")
tab <- as.data.frame(tab)
tab$nation <- rownames(tab)
tab$ecart  <- tab$p95 - tab$p05
tab <- tab[order(-tab$med), c("nation", "p05", "p20", "med", "p80", "p95", "p9975", "ecart")]

cat("--- SYNTHESE, nations suivies -------------------------------------------\n")
f <- tab[tab$nation %in% P$FOCUS, ]
print(format(f, digits = 3, nsmall = 2), row.names = FALSE)

cat("\n--- DISPERSION -----------------------------------------------------------\n")
cat(sprintf("etendue 5e-95e, mediane des nations suivies : %.2f point de coefficient\n", median(f$ecart)))
cat(sprintf("etendue 5e-95e, mediane des 53 associations : %.2f\n", median(tab$ecart)))
cat(sprintf("ecart-type entre nations (de leurs medianes) : %.2f\n", sd(tab$med)))

cat("\n--- DUELS, probabilite que la ligne finisse devant la colonne ------------\n")
duo <- P$FOCUS[P$FOCUS %in% colnames(R)]
M <- outer(duo, duo, Vectorize(function(a, b) if (a == b) NA else mean(R[, a] > R[, b])))
dimnames(M) <- list(duo, duo)
print(round(100 * M))

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
