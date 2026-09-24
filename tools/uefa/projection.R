#!/usr/bin/env Rscript
# ------------------------------------------------------------------------------
# Coefficient UEFA -- projection de saison ENTIERE, phase finale comprise.
# Replique en R du modele embarque dans tools/uefa/page.html (bloc 8, " Fin de
# saison "). Meme bareme, memes parametres, memes controles de conservation.
#
#   Rscript tools/uefa/projection.R [nations.json] [n_sim]
#
# Entree  : tools/uefa/nations.json, ecrit par refresh.mjs.
#           Champs utilises : c (code), t (coefficient 5 ans), tp (points d'equipe
#           acquis cette saison), y[5] (coefficient de saison), a[1:4] (clubs en
#           lice C1/C3/C4 puis total), divisor (clubs engages).
# Sortie  : un data.frame trie, et projection_uefa.csv a cote du script.
#
# LE MODELE, EN UNE PHRASE : la force d'un club est celle de son championnat.
# C'est l'hypothese la plus rustique qui tienne debout. Tous les clubs anglais
# recoivent la meme force -- faux club par club, a peu pres juste en moyenne. Pour
# brancher un vrai classement de puissance par club (Opta, coefficient de club
# UEFA), il n'y a qu'une fonction a remplacer : force().
#
# ENCODAGE : ce fichier est en ASCII pur, sans accent et sans caractere
# typographique. C'est volontaire. Un editeur Windows regle par defaut sur
# CP1252 affiche un fichier UTF-8 accentue en charabia, et R refuse la marque
# d'ordre d'octets UTF-8 en tete de script ("unexpected input"). L'ASCII est le
# seul jeu qui s'ouvre et s'execute a l'identique partout. Merci de ne pas
# remettre d'accents ici.
# ------------------------------------------------------------------------------

# Aucune dependance : nations.json est un tableau plat d'objets, un objet par
# association, et sa forme est stable (elle est ecrite par notre propre extracteur).
# Un petit lecteur maison evite d'imposer jsonlite -- utile sur un poste ou
# l'installer n'est pas trivial, et le controle " 55 associations, 36 clubs par
# competition " plus bas attrape tout de suite un fichier mal lu.
lire_nations <- function(path) {
  txt  <- paste(readLines(path, warn = FALSE), collapse = "")
  objs <- regmatches(txt, gregexpr('\\{[^{}]*\\}', txt))[[1]]
  num  <- function(o, key) {
    m <- regmatches(o, regexpr(sprintf('"%s":(-?[0-9.]+)', key), o))
    if (!length(m)) NA_real_ else as.numeric(sub(sprintf('"%s":', key), "", m))
  }
  vec  <- function(o, key) {
    m <- regmatches(o, regexpr(sprintf('"%s":\\[[^]]*\\]', key), o))
    if (!length(m)) numeric(0)
    else as.numeric(strsplit(gsub(sprintf('"%s":\\[|\\]', key), "", m), ",")[[1]])
  }
  do.call(rbind, lapply(objs, function(o) {
    a <- vec(o, "a"); y <- vec(o, "y")
    data.frame(
      code    = sub('.*"c":"([A-Z]+)".*', "\\1", o),
      coef5   = num(o, "t"),
      pts     = num(o, "tp"),
      coefSai = if (length(y) >= 5) y[5] else NA_real_,
      nC1     = if (length(a) >= 3) a[1] else NA_real_,
      nC3     = if (length(a) >= 3) a[2] else NA_real_,
      nC4     = if (length(a) >= 3) a[3] else NA_real_,
      engages = num(o, "divisor"),
      stringsAsFactors = FALSE)
  }))
}

args    <- commandArgs(trailingOnly = TRUE)
f_json  <- if (length(args) >= 1) args[1] else "tools/uefa/nations.json"
N_SIM   <- if (length(args) >= 2) as.integer(args[2]) else 1200L

# ---- bareme association 2024/25 -> ---------------------------------------------
# Qualifications : victoire 1, nul 0,5 (deja dans les points acquis).
# Phase de ligue et phase finale : victoire 2, nul 1.
# Entree en phase de ligue : 6 points, C1 uniquement (deja dans les points acquis).
# Bonus de classement de phase de ligue : 0,25 point par rang gravi de la 24e a la
#   1re en C1 et C3 ; en C4, 0,125 de la 24e a la 9e puis 0,25 de la 8e a la 1re.
#   Totaux distribues : 75, 75 et 42 points.
# Phase finale : 1,5 / 1 / 0,5 point par tour ATTEINT (8es, quarts, demies, finale).
#   Les barrages (9e-24e) ne donnent aucun bonus de tour, seulement des points de match.
J_TOT  <- c(8L, 8L, 6L)          # journees de phase de ligue, C1 / C3 / C4
KO_BON <- c(1.5, 1.0, 0.5)       # bonus par tour de phase finale atteint
COMP   <- c("C1", "C3", "C4")

rank_bonus <- function(k, r) {
  # k : 1 = C1, 2 = C3, 3 = C4 ; r : rang final en phase de ligue (1 = premier)
  ifelse(r > 24, 0,
    if (k == 3) ifelse(r >= 9, 0.125 * (25 - r), 2 + 0.25 * (9 - r))
    else 0.25 * (25 - r))
}

# ---- parametres du modele ------------------------------------------------------
# Trois, et pas un de plus. Choisis a vue, cales sur rien : ils sont ici pour etre
# contestes, pas pour etre crus. BETA et GAMMA s'appliquent a des ecarts de
# log-coefficient, PNUL est un taux de nul uniforme.
BETA  <- 1.15   # sensibilite du rendement de poule a l'ecart de force
GAMMA <- 1.10   # sensibilite d'un duel de phase finale a l'ecart de force
P_NUL <- 0.24   # taux de match nul, identique pour tous

sig   <- function(x) 1 / (1 + exp(-x))
force <- function(coef5) log(coef5)   # <<< le point d'entree d'un meilleur modele

# ---- calendrier des phases de ligue 2026/27 ------------------------------------
# Fige pour la saison. Sert uniquement a compter les journees DEJA disputees, pour
# ne pas crediter deux fois celles qui sont dans les points acquis.
CAL <- list(
  C1 = as.Date(c("2026-09-08","2026-10-13","2026-10-20","2026-11-03",
                 "2026-11-24","2026-12-08","2027-01-19","2027-01-27")),
  C3 = as.Date(c("2026-09-16","2026-10-15","2026-10-22","2026-11-05",
                 "2026-11-26","2026-12-10","2027-01-21","2027-01-28")),
  C4 = as.Date(c("2026-10-15","2026-10-22","2026-11-05","2026-11-26",
                 "2026-12-10","2026-12-17")))

# ---- lecture des donnees -------------------------------------------------------
dat <- lire_nations(f_json)
message(sprintf("%d associations lues dans %s", nrow(dat), f_json))
dat <- dat[!is.na(dat$engages) & dat$engages > 0, ]

# La date d'arret des donnees ne se devine pas : elle est dans le fichier si on l'a,
# sinon on prend aujourd'hui. Se caler sur l'horloge plutot que sur les donnees
# gonfle le nombre de journees jouees le soir d'un match, et fausse tout.
asof    <- Sys.Date()
jouees  <- vapply(CAL, function(d) sum(d < asof), integer(1))
message(sprintf("Journees disputees au %s : C1 %d/8 - C3 %d/8 - C4 %d/6",
                format(asof, "%d/%m/%Y"), jouees[1], jouees[2], jouees[3]))

# ---- champ de chaque competition ------------------------------------------------
# Reconstruit a partir des effectifs publies : a[k] clubs par nation. Doit faire
# exactement 36 dans chacune des trois, sinon on ne projette pas.
champ <- function(k) {
  n <- dat[[c("nC1","nC3","nC4")[k]]]
  rep(dat$code, times = n)
}
FIELDS <- lapply(1:3, champ)
stopifnot(all(vapply(FIELDS, length, integer(1)) == 36L))

# Rendement attendu par match, renormalise a une moyenne de 1. Cette renormalisation
# n'est pas cosmetique : un match distribue toujours exactement deux points, donc la
# moyenne par club EST 1. Sans elle le modele invente ou perd des points.
rendement <- function(k) {
  f  <- force(dat$coef5[match(FIELDS[[k]], dat$code)])
  e  <- 2 * sig(BETA * (f - mean(f)))
  e / mean(e)
}
E  <- lapply(1:3, rendement)
PW <- lapply(E, function(e) pmax(0, (e - P_NUL) / 2))   # P(victoire) ; P(nul) = P_NUL

# ---- un tour de phase finale ----------------------------------------------------
# Les manches sont jouees : chacune distribue ses deux points, et le qualifie est
# celui qui en a pris le plus (pile ou face si egalite). Rien n'est plaque
# par-dessus, donc le total de points du tour est juste par construction.
duel <- function(pool, manches, f, pts_out) {
  p   <- sample(pool)
  out <- integer(0)
  for (i in seq(1, length(p), by = 2)) {
    a <- p[i]; b <- p[i + 1]
    pa <- (1 - P_NUL) * sig(GAMMA * (f[a] - f[b]))
    sa <- 0; sb <- 0
    for (g in seq_len(manches)) {
      u <- runif(1)
      if (u < pa)           sa <- sa + 2
      else if (u < pa + P_NUL) { sa <- sa + 1; sb <- sb + 1 }
      else                  sb <- sb + 2
    }
    pts_out[a] <- pts_out[a] + sa
    pts_out[b] <- pts_out[b] + sb
    out <- c(out, if (sa > sb) a else if (sb > sa) b
                  else if (runif(1) < sig(GAMMA * (f[a] - f[b]))) a else b)
  }
  list(qualifies = out, pts = pts_out)
}

# ---- simulation ------------------------------------------------------------------
set.seed(20260917)   # deterministe : deux executions du meme jour doivent coincider
codes <- dat$code
tir   <- matrix(0, nrow = N_SIM, ncol = length(codes), dimnames = list(NULL, codes))
ctrl  <- list(koM = numeric(3), ko = numeric(3), rb = numeric(3))

for (s in seq_len(N_SIM)) {
  gain <- setNames(numeric(length(codes)), codes)
  for (k in 1:3) {
    cl <- FIELDS[[k]]; pw <- PW[[k]]; nj <- J_TOT[k]; reste <- nj - jouees[k]
    f  <- force(dat$coef5[match(cl, dat$code)])
    pc <- numeric(length(cl))          # points de ce club, a crediter

    # Deux tirages distincts, et c'est voulu :
    #  - une phase de ligue COMPLETE sert a classer les 36 clubs (bonus de rang et
    #    places de phase finale) ;
    #  - seules les journees RESTANTES sont creditees en points, les journees deja
    #    jouees etant dans les chiffres acquis. Melanger les deux double-compterait.
    manche <- function(n, i) { u <- runif(n); sum(ifelse(u < pw[i], 2, ifelse(u < pw[i] + P_NUL, 1, 0))) }
    classement_pts <- vapply(seq_along(cl), function(i) manche(nj, i), numeric(1))
    if (reste > 0) pc <- vapply(seq_along(cl), function(i) manche(reste, i), numeric(1))

    ord <- order(classement_pts, f, runif(length(cl)), decreasing = TRUE)
    rb  <- rank_bonus(k, seq_along(ord))
    pc[ord] <- pc[ord] + rb
    ctrl$rb[k] <- ctrl$rb[k] + sum(rb)

    lot <- ord[1:8]                                        # qualifies directs pour les 8es
    bar <- duel(ord[9:24], 2, f, pc); pc <- bar$pts         # barrages : pas de bonus de tour
    ctrl$koM[k] <- ctrl$koM[k] + 32
    lot <- c(lot, bar$qualifies)
    for (t in 1:4) {                                       # 8es, quarts, demies, finale
      pc[lot] <- pc[lot] + KO_BON[k]
      ctrl$ko[k] <- ctrl$ko[k] + length(lot) * KO_BON[k]
      manches <- if (t == 4) 1 else 2
      r   <- duel(lot, manches, f, pc); pc <- r$pts
      ctrl$koM[k] <- ctrl$koM[k] + length(lot) * manches
      lot <- r$qualifies
    }
    ag <- tapply(pc, cl, sum)
    gain[names(ag)] <- gain[names(ag)] + ag
  }
  tir[s, ] <- (dat$pts + gain[codes]) / dat$engages
}

# ---- controles de conservation -----------------------------------------------------
# Un modele qui invente des points ne se voit pas a l'oeil nu. Par competition :
# 45 matchs de phase finale, donc 90 points ; 30 participations a un tour ;
# 75 / 75 / 42 points de bonus de classement.
att <- list(koM = c(90, 90, 90), ko = c(45, 30, 15), rb = c(75, 75, 42))
for (f in names(att)) for (k in 1:3) {
  v <- ctrl[[f]][k] / N_SIM
  if (abs(v - att[[f]][k]) > 1e-6)
    warning(sprintf("conservation %s %s : %.3f attendu %.3f", f, COMP[k], v, att[[f]][k]))
}
message("Controles de conservation : ",
        if (all(abs(unlist(ctrl) / N_SIM - unlist(att)) < 1e-6)) "OK" else "ECHEC")

# ---- resultats -----------------------------------------------------------------------
q <- function(x, p) as.numeric(quantile(x, p, names = FALSE, type = 7))
res <- data.frame(
  code      = codes,
  engages   = dat$engages,
  coef_auj  = dat$coefSai,
  p10       = apply(tir, 2, q, 0.10),
  mediane   = apply(tir, 2, q, 0.50),
  p90       = apply(tir, 2, q, 0.90),
  moyenne   = colMeans(tir),
  stringsAsFactors = FALSE)
# total a 5 ans projete : on remplace la saison en cours par sa mediane
res$total5_proj <- dat$coef5 - dat$coefSai + res$mediane
res <- res[order(-res$mediane), ]
res$rang_proj  <- rank(-res$total5_proj, ties.method = "min")

# Probabilite, tirage par tirage, que chaque nation finisse la saison devant la France.
# La comparaison se fait DANS le meme tirage : les deux nations partagent alors les
# memes aleas, ce qui est la seule facon honnete de mesurer un duel.
if ("FRA" %in% codes) {
  res$p_devant_FRA <- vapply(res$code, function(c) mean(tir[, c] > tir[, "FRA"]), numeric(1))
}

print(head(res[, c("code","engages","coef_auj","p10","mediane","p90","total5_proj","rang_proj","p_devant_FRA")], 16),
      digits = 4, row.names = FALSE)

out <- file.path(dirname(f_json), "projection_uefa.csv")
utils::write.csv(res, out, row.names = FALSE, fileEncoding = "UTF-8")
message("ecrit : ", out)
