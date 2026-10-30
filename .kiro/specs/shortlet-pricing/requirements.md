# Requirements: short-let pricing (app 1)

1. The app SHALL price each night from: days until stay, weekend flag, area occupancy %, local event.
2. Rule order: event surge (+35%), last-minute low occupancy (-20%, <=2 days and <60%), high demand (+20%, >=85%), weekend (+10%), fallback base price with a seeded ±2% nudge.
3. Every price SHALL be clamped to the floor and ceiling and rounded to whole units.
4. Every price SHALL carry a plain-language reason.
5. All demo data SHALL be synthetic and labelled EXAMPLE.
6. The demo SHALL show a replay verification and a what-if (e.g. occupancy +20 points) with changed nights.
