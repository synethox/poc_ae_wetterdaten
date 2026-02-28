# Wetterdaten-App

Eine Web-Anwendung zur Suche und Visualisierung historischer Temperaturdaten von Wetterstationen weltweit, basierend auf dem **GHCN-Datensatz** (Global Historical Climatology Network) der NOAA.

---

## Inhaltsverzeichnis

- [Features](#features)
- [Architektur](#architektur)
- [Technologie-Stack](#technologie-stack)
- [Installation & Start](#installation--start)
- [API-Dokumentation](#api-dokumentation)
- [Projektstruktur](#projektstruktur)
- [Tests](#tests)
- [CI/CD](#cicd)
- [Entwicklung](#entwicklung)

---

## Features

1. **Stationssuche (Geodatenbasiert)** – Suche nach Wetterstationen anhand von Koordinaten, Radius (1–100 km) und maximaler Anzahl
2. **Zeitraumfilterung** – Eingrenzung auf Stationen mit Daten im gewählten Zeitraum
3. **Temperaturdaten-Abruf** – Lazy-Download täglicher Messdaten von GHCN mit persistentem DB-Caching
4. **Monatliche Aggregation** – Automatische Berechnung monatlicher Durchschnitte (Tmin, Tavg, Tmax)
5. **Interaktive Visualisierung** – Liniendiagramm (Recharts) und Tabellenansicht, umschaltbar per Toolbar

---

## Architektur

```
Browser (React SPA)
        │ HTTP/JSON
        ▼
   FastAPI Backend ──► Redis (API-Response-Cache)
        │
        ▼
   PostgreSQL + PostGIS (Stationen, Tagesdaten)
        ▲
        │ HTTPS
   NOAA GHCN Server (Datenquelle)
```

Details: siehe [Architecture Communication Canvas](docs/architecture-communication-canvas.md)

---

## Technologie-Stack

| Schicht | Technologie | Zweck |
|---------|-------------|-------|
| Frontend | React 19, TypeScript 5.9, Vite, Recharts 3.7 | SPA mit interaktiven Charts |
| Backend | Python 3.12, FastAPI, Uvicorn | Asynchrone REST-API |
| ORM | SQLAlchemy 2.0 (async), GeoAlchemy2, asyncpg | PostGIS-fähiger Datenbankzugriff |
| Datenbank | PostgreSQL 16, PostGIS 3.4 | Geodaten-Speicherung, räumliche Abfragen |
| Cache | Redis 7 | API-Response-Cache mit TTL |
| Daten | GHCN (httpx, pandas) | Download und Parsing der NOAA-Daten |
| Container | Docker, Docker Compose | Reproduzierbares Deployment |
| CI/CD | GitHub Actions | Automatisierte Tests und Image-Build |

---

## Installation & Start

### Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) und [Docker Compose](https://docs.docker.com/compose/install/) (V2)

### Quickstart

```bash
# Repository klonen
git clone <repository-url>
cd Wetter_funk

# Alle Services starten (Datenbank, Redis, Backend + Frontend)
docker compose up --build
```

Die Anwendung ist dann erreichbar unter: **http://localhost**

### Services

| Service | Image | Port | Beschreibung |
|---------|-------|------|--------------|
| `db` | `postgis/postgis:16-3.4` | 5432 (intern) | PostgreSQL mit PostGIS |
| `redis` | `redis:7-alpine` | 6379 (intern) | API-Response-Cache |
| `backend` | Custom (Multi-Stage) | 80 → Host | FastAPI + statisches Frontend |

### Erststart

Beim ersten Start werden automatisch ~40.000 GHCN-Stationsmetadaten heruntergeladen und in die Datenbank importiert. Dies dauert ca. 1–2 Minuten. Der Fortschritt ist in den Docker-Logs sichtbar:

```bash
docker compose logs -f backend
```

---

## API-Dokumentation

Basis-URL: `http://localhost/api`

### `GET /api/health`

Health-Check-Endpunkt.

**Response:** `{"status": "ok"}`

### `GET /api/stations`

Sucht Wetterstationen in der Nähe gegebener Koordinaten.

| Parameter | Typ | Pflicht | Default | Beschreibung |
|-----------|-----|---------|---------|--------------|
| `lat` | float | ✅ | – | Breitengrad |
| `lon` | float | ✅ | – | Längengrad |
| `radius_km` | float | – | 50 | Suchradius (1–100 km) |
| `limit` | int | – | 10 | Max. Anzahl Ergebnisse (1–50) |
| `from` | string | – | – | Startdatum (YYYY-MM-DD) |
| `to` | string | – | – | Enddatum (YYYY-MM-DD) |

**Beispiel:**
```
GET /api/stations?lat=48.14&lon=11.58&radius_km=50&limit=5&from=2020-01-01&to=2024-12-31
```

**Response:**
```json
[
  {
    "id": "GME00111445",
    "name": "MUENCHEN-STADT",
    "lat": 48.1632,
    "lon": 11.5429,
    "distanceKm": 4.2
  }
]
```

### `GET /api/temperatures`

Ruft monatlich aggregierte Temperaturdaten einer Station ab.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `station_id` | string | ✅ | GHCN Station-ID |
| `from` | string | ✅ | Startdatum (YYYY-MM-DD) |
| `to` | string | ✅ | Enddatum (YYYY-MM-DD) |

**Beispiel:**
```
GET /api/temperatures?station_id=GME00111445&from=2023-01-01&to=2023-12-31
```

**Response:**
```json
[
  {
    "date": "2023-01",
    "level": "month",
    "tmin": -2.3,
    "tavg": 1.5,
    "tmax": 5.2
  }
]
```

---

## Projektstruktur

```
Wetter_funk/
├── .github/workflows/ci.yml    # CI/CD Pipeline
├── docker-compose.yml           # Orchestrierung aller Services
├── docs/
│   └── architecture-communication-canvas.md
├── backend/
│   ├── Dockerfile               # Multi-Stage Build (Node + Python)
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py              # FastAPI App, Lifespan, Routen
│   │   ├── config.py            # Umgebungsvariablen
│   │   ├── database.py          # Async SQLAlchemy Engine
│   │   ├── models.py            # ORM-Modelle (Station, DailyTemperature)
│   │   ├── schemas.py           # Pydantic Response-Schemas
│   │   ├── cache.py             # Redis Cache (graceful degradation)
│   │   └── services/
│   │       ├── ghcn.py          # GHCN Parsing, Download, DB-Import
│   │       ├── stations.py      # PostGIS Stationssuche
│   │       └── temperatures.py  # Temperatur-Abruf und Aggregation
│   └── tests/
│       ├── conftest.py          # Fixtures (AsyncClient, Event Loop)
│       ├── test_api.py          # API-Integrationstests
│       ├── test_cache.py        # Cache-Layer Tests
│       ├── test_config.py       # Konfigurationstests
│       ├── test_ghcn.py         # GHCN Parsing/Download Tests
│       ├── test_lifespan.py     # Lifespan (Startup/Shutdown) Tests
│       ├── test_schemas.py      # Pydantic Schema Tests
│       ├── test_stations.py     # Stationssuche Tests
│       └── test_temperatures.py # Temperatur-Service Tests
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx              # Hauptkomponente mit State-Management
        ├── api/
        │   ├── client.ts        # API-Aufrufe (fetch)
        │   ├── types.ts         # TypeScript-Interfaces
        │   └── mock.ts          # Mock-Daten (Entwicklung)
        └── components/
            ├── Toolbar.tsx      # Filter-Toolbar mit allen Eingaben
            ├── ChartsPanel.tsx  # Recharts Liniendiagramm
            ├── TemperatureTable.tsx  # Datentabelle
            ├── StationsTable.tsx    # Stationsliste
            └── Filters.tsx          # Filter-Formular (alt)
```

---

## Tests

### Backend-Tests ausführen

```bash
cd backend

# Alle Tests
python -m pytest tests/ -v

# Mit Coverage-Report
python -m pytest tests/ --cov=app --cov-report=term-missing

# Einzelne Testdatei
python -m pytest tests/test_ghcn.py -v
```

### Teststrategie

| Ebene | Dateien | Beschreibung |
|-------|---------|--------------|
| **Unit-Tests** | `test_ghcn.py`, `test_cache.py`, `test_stations.py`, `test_temperatures.py`, `test_schemas.py`, `test_config.py` | Isolierte Tests einzelner Module mit Mocking aller Abhängigkeiten |
| **Integrationstests** | `test_api.py` | FastAPI-Endpunkte via httpx AsyncClient (ASGI Transport) |
| **Lifespan-Tests** | `test_lifespan.py` | Startup/Shutdown-Logik mit gemockter DB und Cache |

### Mocking-Strategie

- **Datenbank:** `AsyncMock` für SQLAlchemy `AsyncSession`
- **Redis:** `AsyncMock` für `cache._get_redis`, `cache_get`, `cache_set`
- **HTTP (GHCN):** `AsyncMock` für `_download_text` und `download_daily_csv`
- **FastAPI Lifespan:** Noop-Lifespan-Patch in `conftest.py` für API-Tests

### Aktuelle Testabdeckung

```
Name                           Stmts   Miss  Cover
------------------------------------------------------------
app\cache.py                      29      0   100%
app\config.py                      6      0   100%
app\database.py                    4      0   100%
app\main.py                       54      0   100%
app\models.py                     22      0   100%
app\schemas.py                     3      0   100%
app\services\ghcn.py             102      0   100%
app\services\stations.py          18      0   100%
app\services\temperatures.py      38      0   100%
------------------------------------------------------------
TOTAL                            276      0   100%
```

**80 Tests | 100% Abdeckung**

---

## CI/CD

Die Anwendung verwendet eine **GitHub Actions** Pipeline (`.github/workflows/ci.yml`):

### Pipeline-Schritte

1. **Test** – Führt alle Backend-Tests mit Postgres+PostGIS und Redis Services aus
2. **Build & Push** – Baut das Docker-Image und pushed es in die **GitHub Container Registry** (`ghcr.io`)

### Trigger

- **Push auf `main`:** Tests + Build + Push
- **Pull Request auf `main`:** Nur Tests

### Container-Image laden

```bash
docker pull ghcr.io/<owner>/wetter_funk:latest
```

---

## Entwicklung

### Backend (lokal ohne Docker)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 80
```

Benötigte Umgebungsvariablen:
- `DATABASE_URL` – PostgreSQL-Verbindungsstring (Standard: `postgresql+asyncpg://postgres:postgres@db:5432/wetter`)
- `REDIS_URL` – Redis-Verbindungsstring (Standard: `redis://redis:6379/0`)

### Frontend (Entwicklungsserver)

```bash
cd frontend
npm install
npm run dev
```

Der Vite-Devserver proxied `/api`-Calls an `http://localhost:80` (konfiguriert in `vite.config.ts`).