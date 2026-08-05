#!/usr/bin/env python3
# Prune the stock Supabase docker-compose.yml down to a minimal service set that
# fits a 2 GB box. Keeps only the services the Rurban app actually uses and
# strips depends_on / logging references to the removed ones.
#
# Usage: python3 prune_compose.py docker-compose.yml db kong auth rest storage imgproxy
import sys, yaml

path = sys.argv[1]
keep = set(sys.argv[2:])
if not keep:
    print("No services to keep given", file=sys.stderr)
    sys.exit(1)

with open(path) as f:
    doc = yaml.safe_load(f)

services = doc.get("services", {})
removed = [n for n in services if n not in keep]
for n in removed:
    del services[n]

for name, svc in services.items():
    if not isinstance(svc, dict):
        continue
    dep = svc.get("depends_on")
    if isinstance(dep, dict):
        for d in [d for d in dep if d not in keep]:
            del dep[d]
        if not dep:
            svc.pop("depends_on", None)
    elif isinstance(dep, list):
        svc["depends_on"] = [d for d in dep if d in keep]
        if not svc["depends_on"]:
            svc.pop("depends_on", None)
    # Vector/Logflare are gone; drop any logging blocks that forwarded to them.
    svc.pop("logging", None)

with open(path, "w") as f:
    yaml.safe_dump(doc, f, default_flow_style=False, sort_keys=False)

print("Kept services:   ", sorted(services))
print("Removed services:", sorted(removed))
