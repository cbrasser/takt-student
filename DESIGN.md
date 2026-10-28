# Design: Takt for students

This app speaks bestanden's design language (`~/code/bestandenfmsneufeld/DESIGN.md`, itself yaft's), as cbra-platform's account site ports it: opaque paper leaves with 2px ink outlines and short, hard ink shadows; Bricolage Grotesque names things, Manrope says and counts them; a full-strength hue is the page. Every token is a CSS variable in `src/app.css`. This record holds only what the app adds or changes.

## Courses, not years

bestanden's year hues become one hue per course: Marigold, Lagoon Teal, Lilac, Flamingo (`--hue-0` to `--hue-3`), given to the student's courses in order of their names and repeating after four. `data-hue` on `<html>` sets `--hue` while a lesson is shown, and the hue is the page. Without a lesson on show (sign-in, the overview, the empty state) the page is Fog Ground. A course is always named next to its hue.

## Dark theme

Follows the system setting. Ink and paper swap as in bestanden; the page is the course hue mixed 24% into the dark ground, and the overview's hue strips stay full strength.

## Screens

- **Sign-in:** a narrow column (460px): the wordmark, "Anmelden" as the display title, a lede, one leaf with email, password and the primary button, then "Passwort vergessen" and "Konto erstellen" as links under it. A refusal is an error box inside the leaf.
- **Lesson:** the app bar (wordmark; "Übersicht" and a quiet "Abmelden"), then the head on the hue: course, day and time separated by ink dots, and the topic as the display title ("Noch kein Thema" without one). Then one leaf each for "Ziele", "Wo wir stehen", "Hausaufgaben" and "Material", each only when it has content, and "Letzte Lektion": its day and time in caption type, its topic, then its homework and materials as groups titled over a 2px ink rule.
- **Overview:** "Übersicht" (with a lesson on) or "Gerade keine Lektion" as the title, then cards: the current lesson ("Jetzt"), the next lesson of each course and the last lesson. A card is a paper leaf with a 14px strip of its course's hue on the left, a caption with the kind and the course, the topic in Bricolage and the day and time. The current and the last lesson open on click; a next lesson's card doesn't open, so of its content only the topic shows.
- **Empty:** "Noch keine Lektionen" as the title and a lede saying lessons appear once the teacher plans them.
- **Offline:** a note above the content, "Keine Verbindung. Stand 08:15.", while the last lessons read stay on screen.

- **Update:** in the release desktop app only, a leaf fixed to the bottom right (460px at most): "Neue Version von Takt", the version and that Takt restarts, then a quiet "Später" and the primary "Aktualisieren" ("Wird installiert …" while it runs). A failure is an error box inside the leaf.

## Install page

`installieren.html` (`/installieren` on the web), on Fog Ground with the app's tokens (`src/install.css`): the wordmark, "Takt installieren" as the display title and a lede; two download leaves side by side (macOS, Windows), each a caption, the platform name in Bricolage and a primary "Herunterladen"; a note on the one-time approval; then one leaf each for the macOS and Windows steps (numbered, the button names in bold and «»), "Updates" and "Im Browser".

## Material links

Each material is a link in label weight with a "↗" after it, at least 44px tall. A path the app can't link (no site URL for the course) is shown as plain text.
