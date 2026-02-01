FROM python:3.11-slim

WORKDIR /app

# Requirements kopieren und installieren
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App-Code wird via Volume gemountet (im Development)
# Daher hier kein COPY im Development-Mode

# Port expose
EXPOSE 8000

# Startbefehl
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

## Alles in einem Container - Vereinfachte Lösung

Ja! Hier ist eine **All-in-One Docker Compose** Lösung:

### Projektstruktur:
```
ghcn-project/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # <- WICHTIG! Leere Datei erstellen
│   │   ├── main.py
│   │   ├── stations_loader.py
│   │   └── stations_queries.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── ... (später)
└── docker-compose.yml