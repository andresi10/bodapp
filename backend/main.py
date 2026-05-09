from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from typing import Optional

app = FastAPI()

# Configuración de CORS para que tu frontend pueda hablar con el backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CONEXIÓN A MONGODB ───
# ¡IMPORTANTE! Reemplazá TU_CONTRASEÑA_ACA por la contraseña real que creaste en Atlas
MONGO_URI = "mongodb+srv://andresiDB:Mermelada10.@cluster0.inbswie.mongodb.net/?appName=Cluster0"

# Nos conectamos al cluster
client = MongoClient(MONGO_URI)
# Creamos/Seleccionamos la base de datos "bodapp"
db = client["bodapp"]
# Creamos/Seleccionamos la tabla (colección) "invitados"
coleccion_invitados = db["invitados"]

# ─── MODELO DE DATOS ───
class Invitado(BaseModel):
    id: int
    name: str
    group: str
    rsvp: str
    dietary: str
    phone: str
    plus: str
    notes: str

# ─── RUTAS CRUD ───

# 1. LEER TODOS
@app.get("/api/invitados")
def get_invitados():
    # Buscamos todos los invitados y excluimos el ID interno de Mongo (_id)
    invitados = list(coleccion_invitados.find({}, {"_id": 0}))
    return invitados

# 2. CREAR
@app.post("/api/invitados")
def add_invitado(invitado: Invitado):
    nuevo_invitado = invitado.dict()
    coleccion_invitados.insert_one(nuevo_invitado)
    return {"mensaje": "Invitado guardado en MongoDB exitosamente"}

# 3. ACTUALIZAR (Modificar estado o editar)
@app.put("/api/invitados/{invitado_id}")
def update_invitado(invitado_id: int, datos_nuevos: dict):
    # Buscamos por tu 'id' numérico y le inyectamos los datos nuevos
    resultado = coleccion_invitados.update_one(
        {"id": invitado_id}, 
        {"$set": datos_nuevos}
    )
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitado no encontrado")
    return {"mensaje": "Invitado actualizado en MongoDB"}

# 4. BORRAR
@app.delete("/api/invitados/{invitado_id}")
def delete_invitado(invitado_id: int):
    resultado = coleccion_invitados.delete_one({"id": invitado_id})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invitado no encontrado")
    return {"mensaje": "Invitado eliminado de MongoDB"}