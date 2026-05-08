import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Archivo donde se guardarán los datos permanentemente
DATABASE_FILE = "invitados.json"

class Invitado(BaseModel):
    id: int
    name: str
    group: str
    rsvp: str
    dietary: str = ""
    phone: Optional[str] = ""
    plus: Optional[str] = ""
    notes: Optional[str] = ""

# --- FUNCIONES DE AYUDA PARA EL ARCHIVO ---

def cargar_datos() -> List[dict]:
    if not os.path.exists(DATABASE_FILE):
        return []
    with open(DATABASE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def guardar_datos(datos: List[dict]):
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=4, ensure_ascii=False)

# --- RUTAS DE LA API ---

@app.get("/api/invitados")
def obtener_invitados():
    return cargar_datos()

@app.post("/api/invitados")
def agregar_invitado(invitado: Invitado):
    invitados = cargar_datos()
    invitados.append(invitado.model_dump())
    guardar_datos(invitados)
    return {"mensaje": "Invitado guardado"}

@app.put("/api/invitados/{id_invitado}")
def actualizar_invitado(id_invitado: int, datos: dict):
    invitados = cargar_datos()
    for invitado in invitados:
        if invitado["id"] == id_invitado:
            invitado.update(datos)
            guardar_datos(invitados)
            return {"mensaje": "Actualizado"}
    raise HTTPException(status_code=404, detail="No encontrado")

@app.delete("/api/invitados/{id_invitado}")
def eliminar_invitado(id_invitado: int):
    invitados = cargar_datos()
    nuevos_invitados = [g for g in invitados if g["id"] != id_invitado]
    guardar_datos(nuevos_invitados)
    return {"mensaje": "Eliminado"}