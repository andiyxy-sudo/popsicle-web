#!/bin/sh
# Run once from the root of the popsicle-web repo. Removes files no longer used anywhere in the app.
rm -f components/changes/SinceBar.tsx      # the old "Since Monday" bar (removed from pages in v11.131)
rm -f components/layout/Presence.tsx       # the "Online now" teammates panel (removed in v11.154)
rm -f components/account/Decisions.tsx     # the standalone decision trail (merged into the Timeline in v11.166)
rm -f components/agent/AgentAvatar.tsx     # the old agent avatar (already gone if you ran earlier cleanups)
rm -f app/proxy.ts                         # a stray copy; the real one is proxy.ts at the repo root
echo "Unused files removed."
