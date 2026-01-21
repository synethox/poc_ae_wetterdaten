from fastapi import FastAPI
from sqlmodel import Session, select

from app.db import engine, init_db
from app.models import Raid, RaidCreate, Signup



app = FastAPI()


@app.on_event("startup")
def on_startup():
    # stellt sicher: Tabellen existieren (falls noch nicht)
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/raids")
def list_raids():
    with Session(engine) as session:
        raids = session.exec(select(Raid)).all()
        return raids


@app.post("/raids", response_model=Raid)
def create_raid(raid: RaidCreate):
    db_raid = Raid(
        title=raid.title,
        starts_at=raid.starts_at,
        note=raid.note,
    )

    with Session(engine) as session:
        session.add(db_raid)
        session.commit()
        session.refresh(db_raid)
        return db_raid

@app.get("/signuo", response_model=Signup)
