# Hauntrace

> Every decision leaves a ghost you can replay.

Hauntrace is a lean skeleton for **deterministic, replayable, explainable agents**.
You define typed state, rules and actions; a seeded RNG and an injected clock make
every run reproducible, and every step leaves a hash-chained "ghost" trace that says
which rule fired and why. Replay any run exactly, or ask "what if?" and see which
decisions change.

Built for the Kiroween 2026 hackathon (Skeleton Crew category) using Kiro.
See `.kiro/` for specs, steering and hooks.

License: MIT
