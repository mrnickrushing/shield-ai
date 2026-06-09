"""Production launcher. Reads $PORT in Python so there's no dependency on
shell variable expansion in the container start command."""
import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
