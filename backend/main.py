from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.metadata_routes import router

app = FastAPI(
    title="MetaDataStringEditor API",
    description="Backend API for editing Unity IL2CPP global-metadata.dat files",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
