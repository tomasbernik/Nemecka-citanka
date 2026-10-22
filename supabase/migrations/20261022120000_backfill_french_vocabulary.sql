-- Backfill missing French vocabulary translations without overwriting reviewed values.
do $migration$
declare
  french_translations jsonb := $translations$
{
  "sich verlaufen": "se perdre",
  "das Gebüsch": "les buissons",
  "erschraken": "ont eu peur",
  "erleichtert": "soulagé",
  "die Belohnung": "la récompense",
  "eine verrückte Idee": "une idée folle",
  "gute Laune": "la bonne humeur",
  "die Strecke": "le trajet",
  "ein seltsames Geräusch": "un bruit étrange",
  "flüsterte": "chuchota",
  "im Gebüsch": "dans les buissons",
  "Beide erschraken": "Tous les deux eurent peur",
  "weggelaufen": "s'est enfui",
  "sehr erleichtert": "très soulagée",
  "Als Belohnung": "En récompense",
  "Der Akku war leer": "La batterie était déchargée",
  "den Rückweg": "le chemin du retour",
  "allerdings": "cependant",
  "feststellte": "constata",
  "Verspätung": "le retard",
  "Fortschritt": "le progrès",
  "Innerhalb von zehn Minuten": "En moins de dix minutes",
  "bis er feststellte": "jusqu'à ce qu'il se rende compte",
  "die ganze Zeit": "tout le temps",
  "im Stau": "dans les embouteillages",
  "einen entspannten Start in die Woche": "un début de semaine détendu",
  "seine Verspätung": "son retard",
  "kaum hatte er sich hingesetzt": "à peine s'était-il assis",
  "Markus war erleichtert": "Markus était soulagé",
  "starrte auf den Bildschirm": "fixait l'écran",
  "beschlossen": "décidèrent",
  "Unterstützung": "le soutien",
  "Schwierigkeitsstufen": "les niveaux de difficulté",
  "gegenseitig": "mutuellement",
  "Zusammenhang": "le contexte",
  "angenehm frisch": "agréablement frais",
  "machten sich auf den Weg": "se mirent en route",
  "die höchste Unterstützung": "le niveau d'assistance maximal",
  "Obwohl es bereits Herbst war": "Bien que ce fût déjà l'automne",
  "aus dem Zusammenhang zu erkennen": "comprendre grâce au contexte",
  "eine starke Windböe": "une forte rafale de vent",
  "den Wind meistens im Rücken": "avoir le vent le plus souvent dans le dos",
  "schneller nach Hause als erwartet": "rentrer plus vite que prévu",
  "nicht nur frische Luft bekommen und sich bewegt, sondern auch etwas Deutsch gelernt": "non seulement prendre l'air et faire de l'exercice, mais aussi apprendre un peu d'allemand",
  "anstrengend": "fatigant",
  "überrascht": "surpris",
  "begleitete": "accompagna",
  "unerwarteten Besuch": "une visite inattendue",
  "keine besonderen Pläne": "aucun projet particulier",
  "seit fast einem Jahr": "depuis presque un an",
  "ein großer Berg Geschirr": "une grande pile de vaisselle",
  "beschlossen sie": "ils décidèrent",
  "frisches Gemüse": "des légumes frais",
  "alte Fotos": "de vieilles photos",
  "begleitete sie zur Straßenbahn": "l'accompagna jusqu'au tramway",
  "spontane Tage": "des journées spontanées",
  "die Geldbörse": "le portefeuille",
  "wirbelten ... auf": "soulevèrent ... en tourbillonnant",
  "zurückzudrängen": "repousser",
  "Entlassungsurkunde": "le certificat de libération",
  "versiegelte": "scella",
  "eingeritztes": "gravé",
  "aufgeregt": "nerveux",
  "plötzlich": "soudain",
  "fremden": "étranger",
  "Überraschung": "la surprise",
  "herausfinden": "découvrir",
  "abgelegenes": "isolé",
  "Vorräte ergänzen": "renouveler les provisions",
  "zogen sie sich fluchend zurück": "ils battirent en retraite en jurant",
  "zusammengefaltetes": "plié",
  "Armbrust": "l'arbalète",
  "Frühstückstisch": "la table du petit-déjeuner",
  "schüttelt den Kopf": "secoue la tête",
  "bestellt": "commande",
  "Schaufenster": "la vitrine",
  "neugierig": "curieux",
  "nervös": "nerveux",
  "Stimme": "la voix",
  "Aufgabe": "la tâche",
  "klatschen": "applaudir",
  "Sporthalle": "le gymnase",
  "über Bord geschleudert": "projeté par-dessus bord",
  "überwältigt": "maîtrisé",
  "umgeleitet": "détourné",
  "Unterschlagung": "le détournement de fonds",
  "ans Licht kommt": "est révélé",
  "Geheimnis": "le secret",
  "Kostüm": "le costume",
  "mitmachen": "participer",
  "vorbereiten": "préparer",
  "Bühne": "la scène",
  "hinter allem steckt": "est derrière tout cela",
  "hinterlassen": "laisser derrière soi",
  "versperrten": "bloquèrent",
  "entwaffnen": "désarmer",
  "zuständigen": "compétent",
  "bereit": "prêt",
  "Zuschauer": "le spectateur",
  "vermissen": "manquer à quelqu'un",
  "begleitet": "accompagne",
  "Umschlag": "l'enveloppe",
  "beinahe": "presque",
  "verhindern": "empêcher",
  "erwidern": "répondre",
  "Grundstück": "le terrain",
  "Vertrauen aufzubauen": "établir une relation de confiance",
  "der Wechselrichter": "l'onduleur",
  "die Belastung": "la charge",
  "die Korrosion": "la corrosion",
  "regelmäßige Kontrollen": "des contrôles réguliers",
  "der Anschluss": "le raccordement",
  "kennt sich mit Strom sehr gut aus": "s'y connaît très bien en électricité",
  "die Anschlüsse ganz genau an": "les raccordements très attentivement",
  "Unter Belastung": "sous charge",
  "verliert er den Kontakt": "il perd le contact",
  "vorsichtig fest": "resserra prudemment",
  "ohne Probleme weiter": "continua sans problème",
  "lockere Kontakte": "des contacts desserrés",
  "mehr Vertrauen": "davantage de confiance",
  "gemütlichen": "confortable",
  "dringend": "de toute urgence",
  "unbequemen": "inconfortable",
  "offensichtlich": "manifestement",
  "sich daran halten": "s'y tenir",
  "einen gemütlichen Abend": "une soirée agréable",
  "bekam davon nichts mehr mit": "ne s'en rendit plus compte",
  "dringend auf die Toilette": "aller d'urgence aux toilettes",
  "unbequemen Sofa": "un canapé inconfortable",
  "viel zu müde": "beaucoup trop fatigué",
  "vergaß er allerdings etwas Wichtiges": "il oublia cependant quelque chose d'important",
  "offensichtlich eine interessante Nacht": "manifestement une nuit intéressante",
  "vom Vortag": "de la veille",
  "Das war Absicht!": "C'était intentionnel !",
  "ein voller Erfolg": "un succès total",
  "keinerlei Verhandlungen zuließ": "n'autorisait aucune négociation",
  "allem erdenklichen Komfort": "tout le confort imaginable",
  "ernährungswissenschaftlich zweifelhafte": "douteux sur le plan nutritionnel",
  "ließ sich davon nicht beirren": "ne se laissa pas décourager",
  "bemerkenswerter Selbstsicherheit": "une assurance remarquable",
  "zahlreiche Fragen aufwerfen": "soulever de nombreuses questions",
  "sich dabei das eine oder andere Bier gönnen": "s'offrir une bière ou deux au passage",
  "verlor Tomáš allerdings den Überblick": "Tomáš finit cependant par perdre le fil",
  "Mit der Eleganz eines angeschlagenen Seelöwen": "Avec l'élégance d'un lion de mer mal en point",
  "polizeiliche Vernehmung": "l'interrogatoire de police",
  "Das war Absicht.": "C'était intentionnel.",
  "eine durchaus beachtliche Leistung": "une performance tout à fait remarquable",
  "Frühstück": "le petit-déjeuner",
  "Einkaufszettel": "la liste de courses",
  "Verkäuferin": "la vendeuse",
  "Kasse": "la caisse",
  "vergessen": "oublier"
}
$translations$::jsonb;
begin
  update public.app_articles as article
  set
    vocabulary = (
      select coalesce(
        jsonb_agg(
          case
            when coalesce(btrim(item ->> 'fr'), '') = ''
              and french_translations ? coalesce(item ->> 'de', item ->> 'base')
            then jsonb_set(
              item,
              '{fr}',
              to_jsonb(french_translations ->> coalesce(item ->> 'de', item ->> 'base')),
              true
            )
            else item
          end
          order by item_order
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(article.vocabulary) = 'array' then article.vocabulary
          else '[]'::jsonb
        end
      ) with ordinality as entries(item, item_order)
    ),
    inline_vocabulary = (
      select coalesce(
        jsonb_agg(
          case
            when coalesce(btrim(item ->> 'fr'), '') = ''
              and french_translations ? coalesce(item ->> 'de', item ->> 'base')
            then jsonb_set(
              item,
              '{fr}',
              to_jsonb(french_translations ->> coalesce(item ->> 'de', item ->> 'base')),
              true
            )
            else item
          end
          order by item_order
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(article.inline_vocabulary) = 'array' then article.inline_vocabulary
          else '[]'::jsonb
        end
      ) with ordinality as entries(item, item_order)
    )
  where exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(article.vocabulary) = 'array' then article.vocabulary
        else '[]'::jsonb
      end
    ) as entries(item)
    where coalesce(btrim(item ->> 'fr'), '') = ''
      and french_translations ? coalesce(item ->> 'de', item ->> 'base')
  )
  or exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(article.inline_vocabulary) = 'array' then article.inline_vocabulary
        else '[]'::jsonb
      end
    ) as entries(item)
    where coalesce(btrim(item ->> 'fr'), '') = ''
      and french_translations ? coalesce(item ->> 'de', item ->> 'base')
  );
end
$migration$;

