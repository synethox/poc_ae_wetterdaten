from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# API-Endpunkte
@app.get("/api/hello")
async def hello():
    return {"message": "Hello World"}

# Frontend statisch servieren
app.mount("/static", StaticFiles(directory="frontend/src"), name="static")

@app.get("/")
async def read_root():
    return FileResponse("frontend/src/index.html")