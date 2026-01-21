#Tabelle für die Raids:
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field

class Raid(SQLModel, table=True):
    id : Optional[int] = Field(default=None, primary_key=True)
    title: str
    starts_at: datetime
    note: str = ""

class RaidCreate(SQLModel):
    title: str
    starts_at: datetime
    note: str = ""

class Signup(SQLModel, table=True):
    id : Optional[int] =Field(default=None, primary_key=True)
    raid_id : int
    player_name: str = ""
    role: str = ""
    status: str = ""

class Player_Singup(SQLModel)
