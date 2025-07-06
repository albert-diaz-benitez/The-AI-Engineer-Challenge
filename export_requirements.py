import tomllib
from pathlib import Path

pyproject_path = Path("pyproject.toml")

with pyproject_path.open("rb") as f:
    data = tomllib.load(f)

deps = data.get("project", {}).get("dependencies", [])

with open("api/requirements.txt", "w") as f:
    f.write("\n".join(deps))

print("✅ requirements.txt generado con éxito.")
